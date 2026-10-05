import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Select, Spinner, Tooltip } from '@adecore/ui';
import { formatDecimal, formatNumber } from '@adecore/ui/format';
import type { Aggregates } from '../grid/aggregates.ts';
import { PAGE_SIZES, type PageBounds } from './paging.ts';

export interface TableFooterProps {
    elapsedMs: number;
    bounds: PageBounds;
    pageSize: number;
    counting: boolean;
    /* The count, sum and so on of the selected cells; left out when fewer than two cells are selected. */
    aggregates?: Aggregates | null;
    onCount(): void;
    onFirst(): void;
    onPrevious(): void;
    onNext(): void;
    /* Counts the rows first when they are not counted yet. */
    onLast(): void;
    onPageSizeChange(size: number): void;
}

/* How long the read took, which rows are on the page and how many there are, and the way to the other pages. */
export function TableFooter({
    elapsedMs,
    bounds,
    pageSize,
    counting,
    aggregates,
    onCount,
    onFirst,
    onPrevious,
    onNext,
    onLast,
    onPageSizeChange
}: TableFooterProps) {
    const { t } = useTranslation('database');

    return (
        <footer className="flex h-10 shrink-0 items-center gap-4 border-t border-border px-3 text-xs text-text-muted">
            <span>
                {t('table.queryTime')} <span className="text-text tabular-nums">{t('table.elapsed', { value: formatDecimal(elapsedMs) })}</span>
            </span>
            <span className="text-text tabular-nums">
                {bounds.to === 0 ? t('table.noRows') : t('table.range', { from: formatNumber(bounds.from), to: formatNumber(bounds.to) })}
            </span>
            {bounds.to > 0 && (
                <span className="tabular-nums">{t(bounds.exact ? 'table.total' : 'table.totalAtLeast', { total: formatNumber(bounds.total) })}</span>
            )}
            {!bounds.exact && (
                <Button size="xs" disabled={counting} onClick={onCount}>
                    {counting && <Spinner size={12} />}
                    {t('table.count')}
                </Button>
            )}
            {aggregates != null && <AggregatesSummary aggregates={aggregates} />}
            <div className="ml-auto flex items-center gap-1">
                <Select
                    size="sm"
                    variant="ghost"
                    label={t('table.pageSize')}
                    value={String(pageSize)}
                    items={PAGE_SIZES.map((size) => ({ value: String(size), label: t('table.perPage', { size: formatNumber(size) }) }))}
                    align="end"
                    onValueChange={(value) => onPageSizeChange(Number(value))}
                />
                <IconButton icon={ChevronsLeft} size="sm" label={t('table.firstPage')} disabled={!bounds.hasPrevious} onClick={onFirst} />
                <IconButton icon={ChevronLeft} size="sm" label={t('table.previousPage')} disabled={!bounds.hasPrevious} onClick={onPrevious} />
                <IconButton icon={ChevronRight} size="sm" label={t('table.nextPage')} disabled={!bounds.hasNext} onClick={onNext} />
                <IconButton
                    icon={ChevronsRight}
                    size="sm"
                    label={t('table.lastPage')}
                    tooltip={bounds.exact ? undefined : t('table.lastPageCounts')}
                    disabled={!bounds.hasNext || counting}
                    onClick={onLast}
                />
            </div>
        </footer>
    );
}

/* The figures of the selected cells over the loaded page; the tooltip has the same in full. */
function AggregatesSummary({ aggregates }: { aggregates: Aggregates }) {
    const { t } = useTranslation('database');
    const { count, numeric } = aggregates;
    const figure = (label: string, value: string) => (
        <span className="shrink-0">
            {label} <span className="text-text">{value}</span>
        </span>
    );

    return (
        <Tooltip
            label={
                <span className="flex flex-col gap-0.5 tabular-nums">
                    <span>{t('table.aggregates.cells', { count: formatNumber(count) })}</span>
                    {numeric !== null && (
                        <>
                            <span>{t('table.aggregates.numbers', { count: formatNumber(numeric.count) })}</span>
                            <span>{t('table.aggregates.sumFull', { value: formatDecimal(numeric.sum) })}</span>
                            <span>{t('table.aggregates.averageFull', { value: formatDecimal(numeric.average) })}</span>
                            <span>{t('table.aggregates.minimumFull', { value: numeric.minimumText })}</span>
                            <span>{t('table.aggregates.maximumFull', { value: numeric.maximumText })}</span>
                        </>
                    )}
                </span>
            }
        >
            <span className="flex min-w-0 items-center gap-3 tabular-nums" data-aggregates="">
                {figure(t('table.aggregates.count'), formatNumber(count))}
                {numeric !== null && (
                    <>
                        {figure(t('table.aggregates.sum'), formatDecimal(numeric.sum))}
                        {figure(t('table.aggregates.average'), formatDecimal(numeric.average))}
                        {figure(t('table.aggregates.minimum'), formatDecimal(numeric.minimum))}
                        {figure(t('table.aggregates.maximum'), formatDecimal(numeric.maximum))}
                    </>
                )}
            </span>
        </Tooltip>
    );
}
