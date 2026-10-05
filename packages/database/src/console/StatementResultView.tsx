import { useMemo, useState } from 'react';
import { CircleAlert, PanelRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner, IconButton } from '@adecore/ui';
import { formatDecimal, formatNumber } from '@adecore/ui/format';
import { DataGrid } from '../grid/DataGrid.tsx';
import { previewValueOf } from '../grid/focused-value.ts';
import type { FocusedCell, GridRow } from '../grid/types.ts';
import { ValueDock } from '../grid/ValueDock.tsx';
import type { Engine, StatementResult } from '../protocol/index.ts';
import type { SqlTarget } from '../sql.ts';
import { ValuePanel } from '../value/ValuePanel.tsx';

/* What "Copy as SQL INSERT" names the table of a result that comes from no table. */
const RESULT_TABLE = 'result';

export interface StatementResultViewProps {
    result: StatementResult;
    /* The engine the statement ran on, which decides how "Copy as SQL INSERT" quotes. Without it that format is not offered. */
    engine?: Engine;
    valuePanelOpen?: boolean;
    /* Offers the toggle of the value panel in the footer of a result set. */
    onValuePanelOpenChange?(open: boolean): void;
}

/* One statement's outcome: a result set in a read-only grid, a count of affected rows, or the error the server gave. */
export function StatementResultView({ result, engine, valuePanelOpen = false, onValuePanelOpenChange }: StatementResultViewProps) {
    const { t } = useTranslation('database');
    const [focus, setFocus] = useState<FocusedCell | null>(null);
    const rows = useMemo(
        () => (result.kind === 'rows' ? result.rows.map((cells, index): GridRow => ({ key: `row:${index}`, number: index + 1, cells })) : []),
        [result]
    );
    const sqlTarget = useMemo((): SqlTarget | undefined => (engine === undefined ? undefined : { engine, table: RESULT_TABLE }), [engine]);
    const elapsed = t('console.elapsed', { value: formatDecimal(result.elapsedMs) });

    if (result.kind === 'error') {
        return (
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
                <Banner
                    icon={CircleAlert}
                    tone="error"
                    className="min-w-0"
                    message={
                        <>
                            {result.error.message}
                            {result.error.sqlState !== undefined && (
                                <span className="ml-2 font-mono text-xs text-text-muted">{t('console.sqlState', { state: result.error.sqlState })}</span>
                            )}
                        </>
                    }
                />
                <p className="px-1 text-xs text-text-muted tabular-nums">{elapsed}</p>
            </div>
        );
    }

    if (result.kind === 'done') {
        return (
            <div className="flex flex-col gap-1 p-4 text-sm text-text">
                <p>{t('console.affected', { count: result.affected, formatted: formatNumber(result.affected) })}</p>
                {result.lastInsertId !== null && <p className="text-xs text-text-muted">{t('console.lastInsertId', { id: String(result.lastInsertId) })}</p>}
                <p className="text-xs text-text-muted tabular-nums">{elapsed}</p>
            </div>
        );
    }

    const focusedRow = valuePanelOpen && focus !== null ? rows.find((row) => row.key === focus.rowKey) : undefined;
    const focusedCell = focus === null ? undefined : focusedRow?.cells[focus.column];

    return (
        <>
            <ValueDock
                open={valuePanelOpen}
                panel={
                    <ValuePanel
                        column={focus === null ? null : (result.columns[focus.column] ?? null)}
                        value={focusedCell === undefined ? undefined : previewValueOf(focusedCell)}
                        loading={false}
                        editable={false}
                        onClose={() => onValuePanelOpenChange?.(false)}
                        className="min-w-0 flex-1"
                    />
                }
            >
                <DataGrid
                    label={t('console.result')}
                    columns={result.columns}
                    rows={rows}
                    empty={t('console.noRows')}
                    sqlTarget={sqlTarget}
                    onFocusedCellChange={setFocus}
                />
            </ValueDock>
            <footer className="flex h-10 shrink-0 items-center gap-4 border-t border-border px-3 text-xs text-text-muted">
                <span className="text-text tabular-nums">{t('console.rows', { rows: formatNumber(result.rows.length) })}</span>
                {result.hasMore && <span>{t('console.hasMore')}</span>}
                <span className="tabular-nums">{elapsed}</span>
                {onValuePanelOpenChange !== undefined && (
                    <IconButton
                        icon={PanelRight}
                        size="sm"
                        label={t('console.valuePanel')}
                        aria-pressed={valuePanelOpen}
                        className="ml-auto"
                        onClick={() => onValuePanelOpenChange(!valuePanelOpen)}
                    />
                )}
            </footer>
        </>
    );
}
