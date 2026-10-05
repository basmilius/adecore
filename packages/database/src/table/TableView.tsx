import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { ArrowDownWideNarrow, ArrowUpRight, Check, CircleAlert, CopyPlus, Download, Filter, FilterX, Trash2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    Banner,
    Button,
    ContextMenu,
    Icon,
    isApplePlatform,
    Kbd,
    KEY_SHORTCUTS,
    matchesShortcut,
    messageOf,
    PanelEmpty,
    PromptDialog,
    shortcut,
    Spinner
} from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { DatabaseRequestError, type Connection } from '../client/types.ts';
import { useDatabaseAction, useDatabaseClient, useDatabaseFiles, useDatabaseStorage } from '../client-context.ts';
import { aggregateBlock, blockSize, type RangeBlock } from '../grid/aggregates.ts';
import { DataGrid } from '../grid/DataGrid.tsx';
import { wholeValueOf } from '../grid/focused-value.ts';
import type { GridSort } from '../grid/sort.ts';
import type { ColumnRequest, FocusedCell, GridMenuContext } from '../grid/types.ts';
import { RecordView } from '../grid/RecordView.tsx';
import { ValueDock } from '../grid/ValueDock.tsx';
import { valueOfCell, type EditValue, type RowChange, type Value } from '../protocol/index.ts';
import type { SqlTarget } from '../sql.ts';
import { ValuePanel } from '../value/ValuePanel.tsx';
import {
    addChip,
    cellChip,
    chipsFromQuery,
    chipsToOrderBy,
    chipsToWhere,
    shorten,
    sortsOf,
    toggleSort,
    withSorts,
    type Chip,
    type CommandColumn,
    type FilterChip
} from './command-field.ts';
import { buildGridColumns, buildGridRows, cloneValues, parseRowKey } from './grid-rows.ts';
import { importableColumns } from './import-mapping.ts';
import { ImportDialog } from './ImportDialog.tsx';
import { layoutStorageKey } from './layout-store.ts';
import { DEFAULT_PAGE_SIZE, lastPageOffset, pageBounds } from './paging.ts';
import {
    addInsertWith,
    describeKey,
    emptyPending,
    hasRowChanges,
    isPendingEmpty,
    markDeleted,
    pendingCount,
    removeInsert,
    revertRows,
    rowKeyOf,
    setEdit,
    setInsertValue,
    toRowChanges,
    type PendingChanges,
    type RowSelectionRefs
} from './pending.ts';
import { foreignKeyOf, referenceOf, type Reference } from './references.ts';
import { TableStatusBar } from './TableStatusBar.tsx';
import { TableToolbar } from './TableToolbar.tsx';
import { useLoaded } from './useLoaded.ts';
import { useStoredLayout } from './useStoredLayout.ts';
import { useTableTransfer } from './useTableTransfer.ts';

export interface TableViewProps {
    connection: Connection;
    schema: string;
    table: string;
    /* The filters the view starts with, such as the condition of a jump along a foreign key. They win over the ones remembered. */
    defaultWhere?: string;
    defaultOrderBy?: string;
    /* Told whether the view holds changes that are not submitted, whenever that changes. */
    onDirtyChange?(dirty: boolean): void;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

interface Filters {
    where: string;
    orderBy: string;
}

const NO_KEYS: ReadonlySet<string> = new Set();

/* How much of a value a menu item spells out before it cuts it. */
const MENU_VALUE_LENGTH = 40;

const FOCUS_COMMAND = shortcut('Mod+F');
const DUPLICATE_ROWS = shortcut('Mod+D');

/*
 * The rows of one table: read a page at a time, filtered and sorted with SQL a person types, and
 * editable in place. Changes pile up as pending and go to the server together on Submit.
 */
export function TableView({ connection, schema, table, defaultWhere, defaultOrderBy, onDirtyChange, className, ref }: TableViewProps) {
    // A new table, or the same one asked for with other filters, starts from nothing: no page, no pending change.
    return (
        <TableBody
            key={[connection.id, schema, table, defaultWhere ?? '', defaultOrderBy ?? ''].join('\u0000')}
            connection={connection}
            schema={schema}
            table={table}
            defaultWhere={defaultWhere}
            defaultOrderBy={defaultOrderBy}
            onDirtyChange={onDirtyChange}
            className={className}
            ref={ref}
        />
    );
}

function TableBody({ connection, schema, table, defaultWhere, defaultOrderBy, onDirtyChange, className, ref }: TableViewProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const onAction = useDatabaseAction();
    const files = useDatabaseFiles();
    const { stored, remember } = useStoredLayout(useDatabaseStorage(), layoutStorageKey(connection.id, schema, table));
    const session = useMemo(() => client.session(connection), [client, connection]);
    const grid = useRef<HTMLDivElement>(null);
    const command = useRef<HTMLInputElement>(null);
    const lifetime = useRef<AbortController | null>(null);
    const counter = useRef<AbortController | null>(null);
    const insertedBefore = useRef(0);
    const engine = connection.config.engine;
    const [chips, setChips] = useState<Chip[]>(() =>
        chipsFromQuery(engine, {
            where: defaultWhere ?? stored?.where ?? '',
            orderBy: defaultOrderBy ?? stored?.orderBy ?? '',
            remembered: defaultWhere === undefined ? stored?.filters : undefined
        })
    );
    const [offset, setOffset] = useState(0);
    const [pageSize, setPageSize] = useState(stored?.pageSize ?? DEFAULT_PAGE_SIZE);
    const [pending, setPending] = useState<PendingChanges>(emptyPending);
    const [selected, setSelected] = useState<ReadonlySet<string>>(NO_KEYS);
    const [counted, setCounted] = useState<number | null>(null);
    const [counting, setCounting] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const [discard, setDiscard] = useState<{ run(): void } | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [focus, setFocus] = useState<FocusedCell | null>(null);
    const [recordOpen, setRecordOpen] = useState(false);
    const [recordKey, setRecordKey] = useState<string | null>(null);
    const [focusRequest, setFocusRequest] = useState<FocusedCell | null>(null);
    const [columnRequest, setColumnRequest] = useState<ColumnRequest | null>(null);
    const [range, setRange] = useState<RangeBlock | null>(null);
    const [fetched, setFetched] = useState<{ id: string; rows: unknown; value: Value | undefined } | null>(null);

    const applied = useMemo((): Filters => ({ where: chipsToWhere(chips), orderBy: chipsToOrderBy(engine, chips) }), [chips, engine]);
    const target = `${connection.id}|${schema}|${table}`;
    const structureLoad = useLoaded((signal) => session.structure(schema, table, { signal }), target);
    // The offset travels with the page it belongs to, since the page on screen lags behind the one asked for.
    const rowsLoad = useLoaded(
        async (signal) => ({
            result: await session.rows(
                schema,
                table,
                { where: applied.where || undefined, orderBy: applied.orderBy || undefined, offset, limit: pageSize },
                { signal }
            ),
            offset
        }),
        JSON.stringify([target, applied, offset, pageSize])
    );
    const structure = structureLoad.value;
    const loaded = rowsLoad.value?.result ?? null;
    const loadedOffset = rowsLoad.value?.offset ?? 0;

    const readOnlyReason =
        connection.config.readOnly === true
            ? t('table.readOnly.connection')
            : structure === null
              ? null
              : structure.kind === 'view'
                ? t('table.readOnly.view')
                : structure.rowKey === null
                  ? t('table.readOnly.noKey')
                  : null;
    const editable = readOnlyReason === null && structure !== null && loaded !== null && !rowsLoad.loading;

    const columns = useMemo(() => (loaded === null ? [] : buildGridColumns(loaded, structure)), [loaded, structure]);
    const rows = useMemo(
        () => (loaded === null ? [] : buildGridRows({ structure, loaded, pending, offset: loadedOffset })),
        [loaded, structure, pending, loadedOffset]
    );
    const transfer = useTableTransfer({
        client,
        session,
        files,
        schema,
        table,
        structure,
        where: applied.where,
        orderBy: applied.orderBy,
        onImported: () => {
            setCounted(null);
            rowsLoad.reload();
        }
    });
    const changeCount = pendingCount(pending);
    const dirty = changeCount > 0;
    const reportDirty = useRef(onDirtyChange);
    const reportedDirty = useRef(false);
    const sorts = useMemo(() => sortsOf(chips), [chips]);
    const commandColumns = useMemo((): CommandColumn[] => columns.map((column) => ({ name: column.name, type: column.type })), [columns]);
    const rowByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows]);
    const recordIndex = Math.max(
        0,
        rows.findIndex((row) => row.key === recordKey)
    );
    const selectionFigures = useMemo(
        () =>
            recordOpen || range === null || blockSize(range) < 2
                ? null
                : {
                      columns: range.columns.map((index) => columns[index]?.name ?? ''),
                      aggregates: aggregateBlock(
                          rows.map((row) => row.cells),
                          columns.map((column) => column.kind),
                          range
                      )
                  },
        [recordOpen, range, rows, columns]
    );
    const sqlTarget = useMemo((): SqlTarget => ({ engine, schema, table }), [engine, schema, table]);
    const focusedRow = panelOpen && focus !== null ? rows.find((row) => row.key === focus.rowKey) : undefined;
    const focusedCell = focus === null ? undefined : focusedRow?.cells[focus.column];
    const needsFetch =
        focusedCell !== undefined &&
        focus !== null &&
        wholeValueOf(focusedCell) === undefined &&
        !(focusedCell !== null && typeof focusedCell === 'object' && focusedCell.kind === 'default');
    const focusedRef = focus === null ? null : parseRowKey(focus.rowKey);
    const canFetch = focusedRef?.kind === 'loaded' && structure !== null && loaded !== null && rowKeyOf(structure, loaded, focusedRef.index) !== null;
    const fetchId = needsFetch && canFetch ? `${focus.rowKey}:${focus.column}` : null;

    useEffect(() => {
        reportDirty.current = onDirtyChange;
    });

    useEffect(() => {
        if (dirty !== reportedDirty.current) {
            reportedDirty.current = dirty;
            reportDirty.current?.(dirty);
        }
    }, [dirty]);

    useEffect(() => {
        const controller = new AbortController();
        lifetime.current = controller;
        return () => {
            controller.abort();
            counter.current?.abort();
        };
    }, []);

    useEffect(() => {
        if (pending.inserts.length > insertedBefore.current && grid.current !== null) {
            grid.current.scrollTop = grid.current.scrollHeight;
        }
        insertedBefore.current = pending.inserts.length;
    }, [pending.inserts.length]);

    useEffect(() => {
        if (fetchId === null || focus === null || structure === null || loaded === null) {
            return;
        }
        const row = parseRowKey(focus.rowKey);
        const key = row.kind === 'loaded' ? rowKeyOf(structure, loaded, row.index) : null;
        const name = loaded.columns[focus.column]?.name;
        if (key === null || name === undefined) {
            return;
        }
        const controller = new AbortController();
        session.cell(schema, table, key, name, { signal: controller.signal }).then(
            (value) => {
                if (!controller.signal.aborted) {
                    setFetched({ id: fetchId, rows: loaded, value });
                }
            },
            (error: unknown) => {
                if (!controller.signal.aborted) {
                    setFetched({ id: fetchId, rows: loaded, value: undefined });
                    setFailure(messageOf(error));
                }
            }
        );
        return () => controller.abort();
    }, [fetchId, focus, structure, loaded, session, schema, table]);

    const discardPending = (): void => {
        setPending(emptyPending);
        setSelected(NO_KEYS);
    };

    /* Anything that replaces the page asks first when it would throw pending changes away. */
    const guard = (action: () => void): void => {
        if (isPendingEmpty(pending)) {
            action();
        } else {
            setDiscard({
                run: () => {
                    discardPending();
                    action();
                }
            });
        }
    };

    /* Every change of the chips applies at once; one that changes the page asks first when it would throw pending changes away. */
    const applyChips = (next: readonly Chip[]): void => {
        const where = chipsToWhere(next);
        const orderBy = chipsToOrderBy(engine, next);
        const filters = next.filter((chip): chip is FilterChip => chip.kind === 'filter').map(({ text, sql }) => ({ text, sql }));
        if (where === applied.where && orderBy === applied.orderBy) {
            remember({ filters });
            setChips([...next]);
            return;
        }
        guard(() => {
            remember({ where, orderBy, filters });
            counter.current?.abort();
            setCounting(false);
            setCounted(null);
            setOffset(0);
            setSelected(NO_KEYS);
            setFailure(null);
            setChips([...next]);
        });
    };

    const changeSorts = (next: readonly GridSort[]): void => {
        applyChips(withSorts(chips, next));
    };

    const cellChipAt = (cell: FocusedCell, exclude: boolean): FilterChip | null => {
        const row = parseRowKey(cell.rowKey);
        const column = loaded?.columns[cell.column];
        const value = loaded === null || row.kind !== 'loaded' ? undefined : valueOfCell(loaded.rows[row.index]?.[cell.column] ?? null);
        return column === undefined || value === undefined ? null : cellChip(engine, column.name, value, column.kind, exclude);
    };

    const sortByColumn = (cell: FocusedCell): void => {
        const name = columns[cell.column]?.name;
        if (name !== undefined) {
            applyChips(toggleSort(chips, name));
        }
    };

    const jumpToColumn = (name: string): void => {
        const index = columns.findIndex((column) => column.name === name);
        if (index >= 0) {
            setRecordOpen(false);
            setColumnRequest({ column: index });
        }
    };

    const refresh = (): void => {
        guard(() => {
            setCounted(null);
            setFailure(null);
            structureLoad.reload();
            rowsLoad.reload();
        });
    };

    const goToPage = (nextOffset: number): void => {
        guard(() => {
            setOffset(Math.max(0, nextOffset));
            setSelected(NO_KEYS);
        });
    };

    const changePageSize = (size: number): void => {
        guard(() => {
            remember({ pageSize: size });
            setPageSize(size);
            setOffset(0);
        });
    };

    const countRows = async (): Promise<number | null> => {
        const controller = new AbortController();
        counter.current?.abort();
        counter.current = controller;
        setCounting(true);
        try {
            const total = await session.count(schema, table, applied.where || undefined, { signal: controller.signal });
            if (!controller.signal.aborted) {
                setCounted(total);
                return total;
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                setFailure(messageOf(error));
            }
        } finally {
            if (!controller.signal.aborted) {
                setCounting(false);
            }
        }
        return null;
    };

    const goToLast = async (): Promise<void> => {
        const total = counted ?? (await countRows());
        if (total !== null) {
            goToPage(lastPageOffset(total, pageSize));
        }
    };

    const commit = (rowKey: string, column: number, value: EditValue): void => {
        const name = loaded?.columns[column]?.name;
        const row = parseRowKey(rowKey);
        if (loaded === null || name === undefined) {
            return;
        }
        if (row.kind === 'inserted') {
            setPending((now) => setInsertValue(now, row.id, name, value));
        } else {
            setPending((now) => setEdit(now, row.index, name, value, loaded.rows[row.index]![column] ?? null));
        }
    };

    const loadValue = async (rowKey: string, column: number): Promise<Value | undefined> => {
        const row = parseRowKey(rowKey);
        const name = loaded?.columns[column]?.name;
        const key = row.kind === 'loaded' && structure !== null && loaded !== null ? rowKeyOf(structure, loaded, row.index) : null;
        if (key === null || name === undefined) {
            return undefined;
        }
        try {
            return await session.cell(schema, table, key, name, { signal: lifetime.current?.signal });
        } catch (error) {
            setFailure(messageOf(error));
            return undefined;
        }
    };

    const refsOf = (keys: Iterable<string>): RowSelectionRefs => {
        const loadedRows: number[] = [];
        const inserted: number[] = [];
        for (const key of keys) {
            const row = parseRowKey(key);
            if (row.kind === 'inserted') {
                inserted.push(row.id);
            } else {
                loadedRows.push(row.index);
            }
        }
        return { loaded: loadedRows, inserted };
    };

    const deleteRows = (keys: Iterable<string>): void => {
        setPending((now) => {
            const refs = refsOf(keys);
            const next = refs.inserted.reduce(removeInsert, now);
            return markDeleted(
                next,
                refs.loaded.filter((index) => loaded !== null && structure !== null && rowKeyOf(structure, loaded, index) !== null)
            );
        });
        setSelected(NO_KEYS);
    };

    const deleteSelected = (): void => deleteRows(selected);

    const cloneRows = (keys: readonly string[]): void => {
        const wanted = new Set(keys);
        const copies = rows.filter((row) => wanted.has(row.key)).map((row) => cloneValues(columns, row.cells));
        setPending((now) => copies.reduce(addInsertWith, now));
    };

    const revertRowKeys = (keys: Iterable<string>): void => {
        setPending((now) => revertRows(now, refsOf(keys)));
    };

    const canRevert = (keys: Iterable<string>): boolean => hasRowChanges(pending, refsOf(keys));

    const referenceAt = (cell: FocusedCell): Reference | null => {
        const column = columns[cell.column];
        const key = column === undefined || structure === null ? undefined : foreignKeyOf(structure.foreignKeys, column.name);
        const row = rowByKey.get(cell.rowKey);
        return key === undefined || row === undefined ? null : referenceOf(engine, key, columns, row.cells);
    };

    const isReferenceColumn = (column: number): boolean => {
        const name = columns[column]?.name;
        return name !== undefined && structure !== null && foreignKeyOf(structure.foreignKeys, name) !== undefined;
    };

    const follow = (cell: FocusedCell): void => {
        const reference = referenceAt(cell);
        if (reference !== null) {
            onAction?.({
                kind: 'open-table',
                ref: { connectionId: connection.id, schema: reference.schema, table: reference.table },
                view: 'data',
                where: reference.where
            });
        }
    };

    const toggleRecordView = (): void => {
        if (recordOpen) {
            const row = rows[recordIndex];
            setRecordOpen(false);
            if (row !== undefined) {
                setFocusRequest({ rowKey: row.key, column: focus?.column ?? 0 });
            }
            return;
        }
        const focused = focus === null ? undefined : rows.find((row) => row.key === focus.rowKey);
        setRecordKey((focused ?? rows[0])?.key ?? null);
        setRecordOpen(true);
    };

    const changeRecordIndex = (index: number): void => {
        const row = rows[index];
        if (row !== undefined) {
            setRecordKey(row.key);
            setFocus((now) => (now === null ? now : { rowKey: row.key, column: now.column }));
        }
    };

    const queryMenu = (context: GridMenuContext): ReactNode => {
        const cell = context.cell;
        const name = cell === null ? undefined : columns[cell.column]?.name;
        if (cell === null || name === undefined) {
            return null;
        }
        const include = cellChipAt(cell, false);
        const exclude = cellChipAt(cell, true);
        return (
            <>
                <ContextMenu.Item disabled={include === null} onClick={() => include !== null && applyChips(addChip(chips, include))}>
                    <Icon icon={Filter} size={14} />
                    {t('table.menu.filterOn')} <span className="font-mono">{shorten(include?.text ?? name, MENU_VALUE_LENGTH)}</span>
                </ContextMenu.Item>
                <ContextMenu.Item disabled={exclude === null} onClick={() => exclude !== null && applyChips(addChip(chips, exclude))}>
                    <Icon icon={FilterX} size={14} />
                    {t('table.menu.exclude')} <span className="font-mono">{shorten(exclude?.text ?? name, MENU_VALUE_LENGTH)}</span>
                </ContextMenu.Item>
                <ContextMenu.Item onClick={() => sortByColumn(cell)}>
                    <Icon icon={ArrowDownWideNarrow} size={14} />
                    {t('table.menu.sortBy')} <span className="font-mono">{name}</span>
                </ContextMenu.Item>
                {onAction !== undefined && isReferenceColumn(cell.column) && (
                    <ContextMenu.Item disabled={referenceAt(cell) === null} onClick={() => follow(cell)}>
                        <Icon icon={ArrowUpRight} size={14} />
                        {t('table.goToReferenced')}
                    </ContextMenu.Item>
                )}
            </>
        );
    };

    const gridMenu = (context: GridMenuContext): ReactNode => {
        const count = context.rowKeys.length;
        return (
            <>
                <ContextMenu.Item disabled={!editable} onClick={() => cloneRows(context.rowKeys)}>
                    <Icon icon={CopyPlus} size={14} />
                    {t('table.menu.duplicateRows', { count })}
                    <Kbd shortcut={DUPLICATE_ROWS} />
                </ContextMenu.Item>
                {canRevert(context.rowKeys) && (
                    <ContextMenu.Item onClick={() => revertRowKeys(context.rowKeys)}>
                        <Icon icon={Undo2} size={14} />
                        {t('table.menu.revertRows', { count })}
                    </ContextMenu.Item>
                )}
                <ContextMenu.Item className="text-status-error" disabled={!editable} onClick={() => deleteRows(context.rowKeys)}>
                    <Icon icon={Trash2} size={14} />
                    {t('table.menu.deleteRows', { count })}
                    <Kbd shortcut={KEY_SHORTCUTS.backspace} />
                </ContextMenu.Item>
            </>
        );
    };

    const conflictMessage = (error: DatabaseRequestError, changes: readonly RowChange[]): string => {
        const change = error.change === undefined ? undefined : changes[error.change];
        if (error.change === undefined || change === undefined || change.kind === 'insert') {
            return error.message;
        }
        return t('table.conflict', { number: error.change + 1, row: describeKey(change.key) });
    };

    const submit = async (): Promise<void> => {
        if (structure === null || loaded === null) {
            return;
        }
        const changes = toRowChanges(structure, loaded, pending);
        setSubmitting(true);
        setFailure(null);
        try {
            await session.apply(schema, table, changes);
            discardPending();
            setCounted(null);
            rowsLoad.reload();
        } catch (error) {
            setFailure(error instanceof DatabaseRequestError && error.code === 'conflict' ? conflictMessage(error, changes) : messageOf(error));
        } finally {
            setSubmitting(false);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        // A dialog opened from here is a portal: its events reach this handler through React, not through the DOM.
        if (
            !event.nativeEvent.isComposing &&
            event.currentTarget.contains(event.target as Node) &&
            matchesShortcut(FOCUS_COMMAND, event.nativeEvent, isApplePlatform())
        ) {
            event.preventDefault();
            command.current?.focus();
            command.current?.select();
        }
    };

    const bounds = pageBounds(loadedOffset, loaded?.rows.length ?? 0, loaded?.hasMore ?? false, counted);
    const focusedColumn = focus === null ? null : (columns[focus.column] ?? null);
    const panelEditable =
        editable && focusedRow !== undefined && focusedRow.locked !== true && focusedRow.state !== 'deleted' && focusedColumn?.readOnly !== true;
    const fetchedNow = fetched !== null && fetched.id === fetchId && fetched.rows === loaded;
    const panelValue = ((): Value | undefined => {
        if (focusedCell === undefined || focusedRow === undefined || focus === null) {
            return undefined;
        }
        const whole = wholeValueOf(focusedCell);
        if (whole !== undefined) {
            return whole;
        }
        if (focusedCell !== null && typeof focusedCell === 'object' && focusedCell.kind === 'default') {
            // A pending DEFAULT holds no value of its own, so the panel keeps showing what the row had.
            const row = parseRowKey(focusedRow.key);
            return row.kind === 'loaded' && loaded !== null ? wholeValueOf(loaded.rows[row.index]?.[focus.column] ?? null) : null;
        }
        return fetchedNow ? fetched.value : undefined;
    })();
    const notice = failure ?? rowsLoad.error ?? structureLoad.error;
    const noticeText = (found: NonNullable<typeof transfer.notice>): string => {
        switch (found.kind) {
            case 'exporting':
                return t('table.export.running', { format: found.format.toUpperCase() });
            case 'exported':
                return t('table.export.done', { count: found.rows, rows: formatNumber(found.rows) });
            case 'imported':
                return t('table.import.done', { count: found.rows, rows: formatNumber(found.rows) });
            case 'failed':
                return found.message;
        }
    };

    return (
        <div ref={ref} className={clsx('flex min-h-0 flex-col bg-surface text-text', className)} onKeyDown={handleKeyDown}>
            <TableToolbar
                refreshing={rowsLoad.loading}
                readOnlyReason={readOnlyReason}
                hasSelection={selected.size > 0}
                canRevertSelection={selected.size > 0 && canRevert(selected)}
                valuePanelOpen={panelOpen}
                recordViewOpen={recordOpen}
                transfer={
                    files === undefined
                        ? undefined
                        : {
                              busy: transfer.notice?.kind === 'exporting',
                              onExport: transfer.exportAs,
                              onImport: readOnlyReason === null && structure !== null ? () => guard(transfer.chooseImportFile) : undefined
                          }
                }
                pendingCount={changeCount}
                submitting={submitting}
                engine={engine}
                chips={chips}
                columns={commandColumns}
                pageSize={pageSize}
                bounds={bounds}
                commandRef={command}
                onChipsChange={applyChips}
                onJumpToColumn={jumpToColumn}
                onRefresh={refresh}
                onAddRow={() => setPending((now) => addInsertWith(now, {}))}
                onDeleteRows={deleteSelected}
                onCloneRows={() => cloneRows([...selected])}
                onRevertRows={() => revertRowKeys(selected)}
                onToggleValuePanel={() => setPanelOpen((now) => !now)}
                onToggleRecordView={toggleRecordView}
                onPageSizeChange={changePageSize}
                onFirstPage={() => goToPage(0)}
                onLastPage={() => void goToLast()}
                onSubmit={() => void submit()}
                onRevert={discardPending}
            />
            {notice !== null && (
                <Banner icon={CircleAlert} tone="error" message={notice} className="shrink-0 pt-2">
                    {failure === null ? (
                        <Button size="xs" onClick={refresh}>
                            {t('table.retry')}
                        </Button>
                    ) : (
                        <Button size="xs" onClick={() => setFailure(null)}>
                            {t('table.dismiss')}
                        </Button>
                    )}
                </Banner>
            )}
            {transfer.notice !== null && (
                <Banner
                    icon={transfer.notice.kind === 'failed' ? CircleAlert : transfer.notice.kind === 'exporting' ? Download : Check}
                    tone={transfer.notice.kind === 'failed' ? 'error' : 'neutral'}
                    message={noticeText(transfer.notice)}
                    className="shrink-0 pt-2"
                >
                    {transfer.notice.kind === 'exporting' ? (
                        <>
                            <Spinner size={12} label={t('table.export.running', { format: transfer.notice.format.toUpperCase() })} />
                            <Button size="xs" onClick={transfer.cancelExport}>
                                {t('table.export.cancel')}
                            </Button>
                        </>
                    ) : (
                        <Button size="xs" onClick={transfer.dismiss}>
                            {t('table.dismiss')}
                        </Button>
                    )}
                </Banner>
            )}
            {loaded === null ? (
                <PanelEmpty busy={notice === null}>{notice === null ? t('table.loading') : t('table.notLoaded')}</PanelEmpty>
            ) : (
                <>
                    <ValueDock
                        open={panelOpen}
                        panel={
                            <ValuePanel
                                column={focusedColumn}
                                value={panelValue}
                                loading={fetchId !== null && !fetchedNow}
                                editable={panelEditable}
                                onCommit={(value) => focus !== null && commit(focus.rowKey, focus.column, value)}
                                onClose={() => setPanelOpen(false)}
                                className="min-w-0 flex-1"
                            />
                        }
                    >
                        <div
                            aria-busy={rowsLoad.loading}
                            className={clsx(
                                'relative min-h-0 flex-1 flex-col',
                                recordOpen ? 'hidden' : 'flex',
                                rowsLoad.loading && 'pointer-events-none opacity-60'
                            )}
                        >
                            <DataGrid
                                ref={grid}
                                label={t('table.grid', { table })}
                                columns={columns}
                                rows={rows}
                                editable={editable}
                                empty={t('table.empty')}
                                selectedKeys={selected}
                                onSelectedKeysChange={setSelected}
                                onCommit={commit}
                                loadValue={loadValue}
                                sorts={sorts}
                                onSortsChange={changeSorts}
                                onFocusedCellChange={setFocus}
                                onDeleteSelected={editable ? deleteSelected : undefined}
                                sqlTarget={sqlTarget}
                                queryMenu={queryMenu}
                                menu={gridMenu}
                                onDuplicateRows={editable ? cloneRows : undefined}
                                onFollow={onAction === undefined ? undefined : follow}
                                canFollow={(cell) => referenceAt(cell) !== null}
                                onRangeChange={setRange}
                                initialLayout={stored ?? undefined}
                                onLayoutChange={remember}
                                focusRequest={focusRequest}
                                columnRequest={columnRequest}
                            />
                        </div>
                        {recordOpen && (
                            <RecordView
                                label={t('table.recordFields', { table })}
                                columns={columns}
                                rows={rows}
                                index={recordIndex}
                                onIndexChange={changeRecordIndex}
                                editable={editable}
                                onCommit={commit}
                                loadValue={loadValue}
                                onFocusedCellChange={setFocus}
                                onFollow={onAction === undefined ? undefined : follow}
                                canFollow={(cell) => referenceAt(cell) !== null}
                                empty={t('table.empty')}
                            />
                        )}
                    </ValueDock>
                    <TableStatusBar
                        elapsedMs={loaded.elapsedMs}
                        bounds={bounds}
                        counting={counting}
                        selection={selectionFigures}
                        onCount={() => void countRows()}
                        onPrevious={() => goToPage(offset - pageSize)}
                        onNext={() => goToPage(offset + pageSize)}
                    />
                </>
            )}
            {transfer.importDraft !== null && structure !== null && (
                <ImportDialog
                    open
                    path={transfer.importDraft.path}
                    tableColumns={importableColumns(structure.columns)}
                    sample={transfer.importDraft.sample}
                    header={transfer.importDraft.header}
                    mapping={transfer.importDraft.mapping}
                    busy={transfer.importDraft.busy}
                    error={transfer.importDraft.error}
                    onHeaderChange={transfer.changeHeader}
                    onMappingChange={transfer.changeMapping}
                    onImport={transfer.runImport}
                    onCancel={transfer.closeImport}
                    onOpenChange={(open) => !open && transfer.closeImport()}
                />
            )}
            <PromptDialog
                open={discard !== null}
                danger
                title={t('table.discard.title')}
                description={t('table.discard.description')}
                confirmLabel={t('table.discard.confirm')}
                onConfirm={() => {
                    discard?.run();
                    setDiscard(null);
                }}
                onOpenChange={(open) => {
                    if (!open) {
                        setDiscard(null);
                    }
                }}
            />
        </div>
    );
}
