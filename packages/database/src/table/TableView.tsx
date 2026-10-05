import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { CircleAlert, CopyPlus, Filter, Trash2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, ContextMenu, Icon, messageOf, PanelEmpty, PromptDialog } from '@adecore/ui';
import { DatabaseRequestError, type Connection } from '../client/types.ts';
import { useDatabaseClient } from '../client-context.ts';
import { DataGrid } from '../grid/DataGrid.tsx';
import { wholeValueOf } from '../grid/focused-value.ts';
import type { GridSort } from '../grid/sort.ts';
import type { FocusedCell, GridMenuContext } from '../grid/types.ts';
import { ValueDock } from '../grid/ValueDock.tsx';
import { valueOfCell, type EditValue, type RowChange, type Value } from '../protocol/index.ts';
import { andWhere, equalsCondition, orderByClause, parseOrderBy, type SqlTarget } from '../sql.ts';
import { ValuePanel } from '../value/ValuePanel.tsx';
import { buildGridColumns, buildGridRows, cloneValues, parseRowKey } from './grid-rows.ts';
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
import { TableFooter } from './TableFooter.tsx';
import { TableToolbar, type FilterField } from './TableToolbar.tsx';
import { useLoaded } from './useLoaded.ts';

export interface TableViewProps {
    connection: Connection;
    schema: string;
    table: string;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

interface Filters {
    where: string;
    orderBy: string;
}

const NO_FILTERS: Filters = { where: '', orderBy: '' };
const NO_KEYS: ReadonlySet<string> = new Set();

/*
 * The rows of one table: read a page at a time, filtered and sorted with SQL a person types, and
 * editable in place. Changes pile up as pending and go to the server together on Submit.
 */
export function TableView({ connection, schema, table, className, ref }: TableViewProps) {
    // A new table starts from nothing: no filter, no page, no pending change.
    return (
        <TableBody
            key={`${connection.id}\u0000${schema}\u0000${table}`}
            connection={connection}
            schema={schema}
            table={table}
            className={className}
            ref={ref}
        />
    );
}

function TableBody({ connection, schema, table, className, ref }: TableViewProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const session = useMemo(() => client.session(connection), [client, connection]);
    const grid = useRef<HTMLDivElement>(null);
    const lifetime = useRef<AbortController | null>(null);
    const counter = useRef<AbortController | null>(null);
    const insertedBefore = useRef(0);
    const [draft, setDraft] = useState<Filters>(NO_FILTERS);
    const [applied, setApplied] = useState<Filters>(NO_FILTERS);
    const [offset, setOffset] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [pending, setPending] = useState<PendingChanges>(emptyPending);
    const [selected, setSelected] = useState<ReadonlySet<string>>(NO_KEYS);
    const [counted, setCounted] = useState<number | null>(null);
    const [counting, setCounting] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const [discard, setDiscard] = useState<{ run(): void } | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [focus, setFocus] = useState<FocusedCell | null>(null);
    const [fetched, setFetched] = useState<{ id: string; rows: unknown; value: Value | undefined } | null>(null);

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
    const engine = connection.config.engine;

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
    const changeCount = pendingCount(pending);
    const sorts = useMemo(
        () =>
            loaded === null
                ? []
                : (parseOrderBy(
                      engine,
                      applied.orderBy,
                      loaded.columns.map((column) => column.name)
                  ) ?? []),
        [engine, applied.orderBy, loaded]
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

    const applyFilters = (next: Filters): void => {
        guard(() => {
            setDraft(next);
            counter.current?.abort();
            setCounting(false);
            setCounted(null);
            setOffset(0);
            setSelected(NO_KEYS);
            setFailure(null);
            if (next.where === applied.where && next.orderBy === applied.orderBy) {
                rowsLoad.reload();
            } else {
                setApplied(next);
            }
        });
    };

    const changeSorts = (next: readonly GridSort[]): void => {
        applyFilters({ ...draft, orderBy: orderByClause(engine, next) });
    };

    const filterByValue = (cell: FocusedCell): void => {
        const row = parseRowKey(cell.rowKey);
        const column = loaded?.columns[cell.column];
        const value = loaded === null || row.kind !== 'loaded' ? undefined : valueOfCell(loaded.rows[row.index]?.[cell.column] ?? null);
        if (column !== undefined && value !== undefined) {
            applyFilters({ ...draft, where: andWhere(draft.where, equalsCondition(engine, column.name, value, column.kind)) });
        }
    };

    const clearFilter = (field: FilterField): void => {
        const next = { ...draft, [field]: '' };
        setDraft(next);
        if (applied[field] !== '') {
            applyFilters({ ...applied, [field]: '' });
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

    const canFilterBy = (cell: FocusedCell): boolean => {
        const row = parseRowKey(cell.rowKey);
        return loaded !== null && row.kind === 'loaded' && valueOfCell(loaded.rows[row.index]?.[cell.column] ?? null) !== undefined;
    };

    const gridMenu = (context: GridMenuContext): ReactNode => {
        const count = context.rowKeys.length;
        return (
            <>
                {context.cell !== null && (
                    <ContextMenu.Item disabled={!canFilterBy(context.cell)} onClick={() => filterByValue(context.cell!)}>
                        <Icon icon={Filter} size={14} />
                        {t('table.filterByValue')}
                    </ContextMenu.Item>
                )}
                <ContextMenu.Item disabled={!editable} onClick={() => cloneRows(context.rowKeys)}>
                    <Icon icon={CopyPlus} size={14} />
                    {t('table.menu.cloneRows', { count })}
                </ContextMenu.Item>
                <ContextMenu.Item disabled={!canRevert(context.rowKeys)} onClick={() => revertRowKeys(context.rowKeys)}>
                    <Icon icon={Undo2} size={14} />
                    {t('table.menu.revertRows', { count })}
                </ContextMenu.Item>
                <ContextMenu.Item disabled={!editable} onClick={() => deleteRows(context.rowKeys)}>
                    <Icon icon={Trash2} size={14} />
                    {t('table.menu.deleteRows', { count })}
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

    return (
        <div ref={ref} className={clsx('flex min-h-0 flex-col bg-surface text-text', className)}>
            <TableToolbar
                refreshing={rowsLoad.loading}
                readOnlyReason={readOnlyReason}
                hasSelection={selected.size > 0}
                canRevertSelection={selected.size > 0 && canRevert(selected)}
                valuePanelOpen={panelOpen}
                pendingCount={changeCount}
                submitting={submitting}
                where={draft.where}
                orderBy={draft.orderBy}
                onFilterChange={(field, value) => setDraft((now) => ({ ...now, [field]: value }))}
                onApplyFilters={() => applyFilters(draft)}
                onClearFilter={clearFilter}
                onRefresh={refresh}
                onAddRow={() => setPending((now) => addInsertWith(now, {}))}
                onDeleteRows={deleteSelected}
                onCloneRows={() => cloneRows([...selected])}
                onRevertRows={() => revertRowKeys(selected)}
                onToggleValuePanel={() => setPanelOpen((now) => !now)}
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
                            className={clsx('relative flex min-h-0 flex-1 flex-col', rowsLoad.loading && 'pointer-events-none opacity-60')}
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
                                menu={gridMenu}
                            />
                        </div>
                    </ValueDock>
                    <TableFooter
                        elapsedMs={loaded.elapsedMs}
                        bounds={bounds}
                        pageSize={pageSize}
                        counting={counting}
                        onCount={() => void countRows()}
                        onFirst={() => goToPage(0)}
                        onPrevious={() => goToPage(offset - pageSize)}
                        onNext={() => goToPage(offset + pageSize)}
                        onLast={() => void goToLast()}
                        onPageSizeChange={changePageSize}
                    />
                </>
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
