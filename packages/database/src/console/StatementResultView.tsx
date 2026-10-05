import { useMemo } from 'react';
import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner } from '@adecore/ui';
import { formatDecimal, formatNumber } from '@adecore/ui/format';
import { DataGrid } from '../grid/DataGrid.tsx';
import type { GridRow } from '../grid/types.ts';
import type { StatementResult } from '../protocol/index.ts';

export interface StatementResultViewProps {
    result: StatementResult;
}

/* One statement's outcome: a result set in a read-only grid, a count of affected rows, or the error the server gave. */
export function StatementResultView({ result }: StatementResultViewProps) {
    const { t } = useTranslation('database');
    const rows = useMemo(
        () => (result.kind === 'rows' ? result.rows.map((cells, index): GridRow => ({ key: `row:${index}`, number: index + 1, cells })) : []),
        [result]
    );
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

    return (
        <>
            <DataGrid label={t('console.result')} columns={result.columns} rows={rows} empty={t('console.noRows')} />
            <footer className="flex h-10 shrink-0 items-center gap-4 border-t border-border px-3 text-xs text-text-muted">
                <span className="text-text tabular-nums">{t('console.rows', { rows: formatNumber(result.rows.length) })}</span>
                {result.hasMore && <span>{t('console.hasMore')}</span>}
                <span className="tabular-nums">{elapsed}</span>
            </footer>
        </>
    );
}
