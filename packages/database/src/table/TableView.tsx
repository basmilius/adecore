import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, messageOf, PanelEmpty, PromptDialog } from '@adecore/ui';
import { DatabaseRequestError, type Connection } from '../client/types.ts';
import { useDatabaseClient } from '../client-context.ts';
import { DataGrid } from '../grid/DataGrid.tsx';
import type { EditValue, RowChange, Value } from '../protocol/index.ts';
import { buildGridColumns, buildGridRows, parseRowKey } from './grid-rows.ts';
import { DEFAULT_PAGE_SIZE, pageBounds } from './paging.ts';
import {
    addInsert,
    describeKey,
    emptyPending,
    isPendingEmpty,
    markDeleted,
    pendingCount,
    removeInsert,
    rowKeyOf,
    setEdit,
    setInsertValue,
    toRowChanges,
    type PendingChanges
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

    const target = `${connection.id}|${schema}|${table}`;
    const structureLoad = useLoaded((signal) => session.structure(schema, table, { signal }), target);
    const rowsLoad = useLoaded(
        (signal) =>
            session.rows(schema, table, { where: applied.where || undefined, orderBy: applied.orderBy || undefined, offset, limit: pageSize }, { signal }),
        JSON.stringify([target, applied, offset, pageSize])
    );
    const structure = structureLoad.value;
    const loaded = rowsLoad.value;

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
    const editable = readOnlyReason === null && structure !== null && loaded !== null;

    const columns = useMemo(() => (loaded === null ? [] : buildGridColumns(loaded, structure)), [loaded, structure]);
    const rows = useMemo(() => (loaded === null ? [] : buildGridRows({ structure, loaded, pending, offset })), [loaded, structure, pending, offset]);
    const changeCount = pendingCount(pending);

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

    const countRows = async (): Promise<void> => {
        const controller = new AbortController();
        counter.current?.abort();
        counter.current = controller;
        setCounting(true);
        try {
            const total = await session.count(schema, table, applied.where || undefined, { signal: controller.signal });
            if (!controller.signal.aborted) {
                setCounted(total);
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

    const deleteSelected = (): void => {
        setPending((now) => {
            let next = now;
            const existing: number[] = [];
            for (const key of selected) {
                const row = parseRowKey(key);
                if (row.kind === 'inserted') {
                    next = removeInsert(next, row.id);
                } else if (loaded !== null && structure !== null && rowKeyOf(structure, loaded, row.index) !== null) {
                    existing.push(row.index);
                }
            }
            return markDeleted(next, existing);
        });
        setSelected(NO_KEYS);
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

    const bounds = pageBounds(offset, loaded?.rows.length ?? 0, loaded?.hasMore ?? false, counted);
    const notice = failure ?? rowsLoad.error ?? structureLoad.error;

    return (
        <div ref={ref} className={clsx('flex min-h-0 flex-col bg-surface text-text', className)}>
            <TableToolbar
                refreshing={rowsLoad.loading}
                readOnlyReason={readOnlyReason}
                hasSelection={selected.size > 0}
                pendingCount={changeCount}
                submitting={submitting}
                where={draft.where}
                orderBy={draft.orderBy}
                onFilterChange={(field, value) => setDraft((now) => ({ ...now, [field]: value }))}
                onApplyFilters={() => applyFilters(draft)}
                onClearFilter={clearFilter}
                onRefresh={refresh}
                onAddRow={() => setPending(addInsert)}
                onDeleteRows={deleteSelected}
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
                    <div className={clsx('relative flex min-h-0 flex-1 flex-col', rowsLoad.loading && 'opacity-60')}>
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
                        />
                    </div>
                    <TableFooter
                        elapsedMs={loaded.elapsedMs}
                        bounds={bounds}
                        pageSize={pageSize}
                        counting={counting}
                        onCount={() => void countRows()}
                        onPrevious={() => goToPage(offset - pageSize)}
                        onNext={() => goToPage(offset + pageSize)}
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
