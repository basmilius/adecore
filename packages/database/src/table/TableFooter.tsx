import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Select, Spinner } from '@adecore/ui';
import { formatDecimal, formatNumber } from '@adecore/ui/format';
import { PAGE_SIZES, type PageBounds } from './paging.ts';

export interface TableFooterProps {
    elapsedMs: number;
    bounds: PageBounds;
    pageSize: number;
    counting: boolean;
    onCount(): void;
    onPrevious(): void;
    onNext(): void;
    onPageSizeChange(size: number): void;
}

/* How long the read took, which rows are on the page and how many there are, and the way to the other pages. */
export function TableFooter({ elapsedMs, bounds, pageSize, counting, onCount, onPrevious, onNext, onPageSizeChange }: TableFooterProps) {
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
                <IconButton icon={ChevronLeft} size="sm" label={t('table.previousPage')} disabled={!bounds.hasPrevious} onClick={onPrevious} />
                <IconButton icon={ChevronRight} size="sm" label={t('table.nextPage')} disabled={!bounds.hasNext} onClick={onNext} />
            </div>
        </footer>
    );
}
