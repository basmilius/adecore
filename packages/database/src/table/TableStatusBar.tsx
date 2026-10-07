import type { Ref } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonGroup, IconButton, Spinner, Tooltip } from '@adecore/ui';
import { formatDecimal, formatNumber, formatRounded } from '@adecore/ui/format';
import { useNumberNotation } from '../client-context.ts';
import type { Aggregates } from '../grid/aggregates.ts';
import { numeralText } from '../grid/display.ts';
import type { PageBounds } from './paging.ts';

/* What the selected cells add up to, and which columns they are in. */
export interface SelectionFigures {
    readonly columns: readonly string[];
    readonly aggregates: Aggregates;
}

export interface TableStatusBarProps {
    elapsedMs: number;
    bounds: PageBounds;
    counting: boolean;
    /* Shown on the right; left out when fewer than two cells are selected. */
    selection?: SelectionFigures | null;
    onCount(): void;
    onPrevious(): void;
    onNext(): void;
    className?: string;
    ref?: Ref<HTMLElement>;
}

/* Which rows are on the page and how many there are, the way to the other pages, and the figures of the selected cells. */
export function TableStatusBar({ elapsedMs, bounds, counting, selection, onCount, onPrevious, onNext, className, ref }: TableStatusBarProps) {
    const { t } = useTranslation('database');

    return (
        <footer ref={ref} className={clsx('flex h-9 shrink-0 items-center gap-3 border-t border-border px-3 text-xs text-text-muted', className)}>
            <span className="flex items-center gap-1 tabular-nums">
                {bounds.to === 0 ? t('table.noRows') : t('table.range', { from: formatNumber(bounds.from), to: formatNumber(bounds.to) })}
                {bounds.to > 0 &&
                    (bounds.exact ? (
                        <span>{t('table.total', { total: formatNumber(bounds.total) })}</span>
                    ) : (
                        <>
                            <span>{t('table.of')}</span>
                            <Button size="xs" aria-label={t('table.count')} disabled={counting} onClick={onCount}>
                                {counting && <Spinner size={12} />}
                                {t('table.atLeast', { total: formatNumber(bounds.total) })}
                            </Button>
                        </>
                    ))}
            </span>
            <ButtonGroup>
                <IconButton icon={ChevronLeft} size="sm" label={t('table.previousPage')} disabled={!bounds.hasPrevious} onClick={onPrevious} />
                <IconButton icon={ChevronRight} size="sm" label={t('table.nextPage')} disabled={!bounds.hasNext} onClick={onNext} />
            </ButtonGroup>
            <Tooltip label={t('table.queryTime')}>
                <span className="text-text-faint tabular-nums">{t('table.elapsed', { value: formatDecimal(elapsedMs) })}</span>
            </Tooltip>
            {selection != null && <SelectionSummary selection={selection} />}
        </footer>
    );
}

function SelectionSummary({ selection }: { selection: SelectionFigures }) {
    const { t } = useTranslation('database');
    const { columns, aggregates } = selection;
    const { count, numeric } = aggregates;
    const notation = useNumberNotation();
    const figure = (label: string, value: string) => (
        <span className="shrink-0">
            <span className="text-text-faint">{label}</span> <span className="text-text">{value}</span>
        </span>
    );

    return (
        <span className="ml-auto flex min-w-0 items-center gap-4 tabular-nums" data-selection="">
            <span className="min-w-0 truncate font-mono text-text">
                {columns.length === 1 ? columns[0] : t('table.aggregates.columns', { formatted: formatNumber(columns.length) })}
            </span>
            <span className="shrink-0 text-text-faint">{t('table.aggregates.cells', { count, cells: formatNumber(count) })}</span>
            {numeric !== null && (
                <>
                    {figure(t('table.aggregates.sum'), formatRounded(numeric.sum, 2))}
                    {figure(t('table.aggregates.average'), formatRounded(numeric.average, 2))}
                    {figure(t('table.aggregates.minimum'), numeralText(numeric.minimumText, notation))}
                    {figure(t('table.aggregates.maximum'), numeralText(numeric.maximumText, notation))}
                </>
            )}
        </span>
    );
}
