import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import type { UiProps } from '@adecore/intelligent-ui';
import { Button, Icon, KeyValueList, Pill } from '@adecore/ui';
import { formatBytes, formatDuration, formatMoment, formatNumber, formatPercent, formatRounded } from '@adecore/ui/format';
import { useBlockLocal } from '../block-local';
import { uiChildrenOf, uiWithUnit } from '../node-text';
import type { UiLiveValue, UiRendererProps } from '../render-context';
import { isNumericColumn, UI_TABLE_ROWS, uiTableCell, uiTableColumns, type UiTableCell, type UiTableColumn } from '../table-data';
import { UI_TONE_TEXT } from '../tones';
import { UiFallbackPart } from '../UiFallbackPart';

/* EntityList draws a hairline between its rows from this many on. */
const DIVIDED_FROM = 7;

/*
 * A number that live readings keep up to date. Keyed by its text, so a value that changed mounts
 * again and lights up once, even when it changes again before the last light settled.
 */
function LiveFigure({ text, previous, live, className }: { text: string; previous?: string; live?: UiLiveValue; className?: string }) {
    const lit = live !== undefined && live.changed && !live.stale && previous !== text;
    return (
        <span key={text} className={clsx(live?.stale ? 'text-text-muted' : 'text-text', lit && 'chat-ui-changed', className)}>
            {text}
        </span>
    );
}

export function StatsRenderer({ children }: UiRendererProps<UiProps<'Stats'>>) {
    return <div className="chat-ui-nodes grid grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-2">{children}</div>;
}

/* The arrow and the number say which way a value went; only a tone says whether that is good. */
export function StatRenderer({ node, context }: UiRendererProps<UiProps<'Stat'>>) {
    const { t } = useTranslation('agent-chat');
    const { label, value, previous, unit, tone } = node.props;
    const live = context.liveValue?.(node.id, 'value');
    const change = previous === undefined ? null : value - previous;
    const arrow = change === null || change === 0 ? ArrowRight : change > 0 ? ArrowUp : ArrowDown;
    const from = previous === undefined ? '' : uiWithUnit(formatRounded(previous, 2), unit);
    // A change from zero has no percentage.
    const percent = change === null || previous === undefined || previous === 0 ? null : formatPercent(Math.abs((change / previous) * 100));
    return (
        <div className="flex min-w-0 flex-col gap-0.5 rounded-md bg-surface-hover px-2 py-1.5">
            <span className="truncate text-xs text-text-muted">{label}</span>
            <LiveFigure
                text={uiWithUnit(formatRounded(value, 2), unit)}
                previous={typeof live?.previous === 'number' ? uiWithUnit(formatRounded(live.previous, 2), unit) : undefined}
                live={live}
                className="text-lg font-semibold tabular-nums"
            />
            {change !== null && (
                <span className={clsx('flex items-center gap-1 text-xs tabular-nums', tone === undefined ? 'text-text-faint' : UI_TONE_TEXT[tone])}>
                    <Icon icon={arrow} size={12} className="shrink-0" />
                    <span className="min-w-0 truncate">
                        {percent === null ? t('blocks.stat.from', { previous: from }) : t('blocks.stat.change', { change: percent, previous: from })}
                    </span>
                </span>
            )}
        </div>
    );
}

export function EntityListRenderer({ node, children }: UiRendererProps<UiProps<'EntityList'>>) {
    return (
        <KeyValueList.Root divided={uiChildrenOf(node, 'Entry').length >= DIVIDED_FROM} className="chat-ui-nodes px-2">
            {children}
        </KeyValueList.Root>
    );
}

export function EntryRenderer({ node, children }: UiRendererProps<UiProps<'Entry'>>) {
    return (
        <KeyValueList.Item>
            <KeyValueList.Name>{node.props.label}</KeyValueList.Name>
            <KeyValueList.Value>{children}</KeyValueList.Value>
        </KeyValueList.Item>
    );
}

function numberText(cell: Extract<UiTableCell, { kind: 'number' }>, unit: string | undefined): string {
    return cell.as === 'bytes' ? formatBytes(cell.value) : cell.as === 'duration' ? formatDuration(cell.value) : uiWithUnit(formatRounded(cell.value, 2), unit);
}

function Cell({ value, column, live }: { value: unknown; column: UiTableColumn; live?: UiLiveValue }) {
    const cell = uiTableCell(value, column);
    switch (cell.kind) {
        case 'empty':
            return null;
        case 'text':
            return <>{cell.text}</>;
        case 'number': {
            const before = live?.previous === undefined ? undefined : uiTableCell(live.previous, column);
            return (
                <LiveFigure
                    text={numberText(cell, column.unit)}
                    previous={before?.kind === 'number' ? numberText(before, column.unit) : undefined}
                    live={live}
                />
            );
        }
        case 'date':
            return <time dateTime={new Date(cell.at).toISOString()}>{formatMoment(cell.at)}</time>;
        case 'file':
            // A cell is no link target the host checked, so its path stays text.
            return <span className="font-mono text-code break-all">{cell.path}</span>;
        case 'tag':
            return (
                <Pill shape="tag" size="sm">
                    {cell.text}
                </Pill>
            );
    }
}

/*
 * Rows under a sticky head, scrolling inside 320px and sideways when wider than the column. Rows
 * arrive one by one while the block streams, without animation; past fifty a person asks for the rest.
 */
export function TableRenderer({ node, context }: UiRendererProps<UiProps<'Table'>>) {
    const { t } = useTranslation('agent-chat');
    const [all, setAll] = useBlockLocal(context, node.id, () => false);
    const columns = uiTableColumns(node);
    if (columns.length === 0) {
        return <UiFallbackPart fallback={node.fallback} problem={{ kind: 'failed' }} />;
    }
    const { rows } = node.props;
    const shown = all ? rows : rows.slice(0, UI_TABLE_ROWS);
    return (
        <div className="flex flex-col items-start gap-1.5">
            <div className="max-h-80 w-full overflow-auto rounded-md border border-border-soft">
                <table
                    aria-label={t('blocks.table.label', { columns: columns.map((column) => column.title).join(', ') })}
                    className="w-full border-collapse text-xs tabular-nums"
                >
                    <thead className="sticky top-0 z-1 bg-surface-hover">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    scope="col"
                                    className={clsx(
                                        'h-8 px-2 font-medium whitespace-nowrap text-text-muted',
                                        isNumericColumn(column) ? 'text-right' : 'text-left'
                                    )}
                                >
                                    {column.title}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((row, index) => (
                            // Rows only ever grow at the end while a block streams, so the place of a row is a stable key.
                            <tr key={index} className="border-t border-border-soft">
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={clsx('h-8 px-2 text-text', isNumericColumn(column) ? 'text-right whitespace-nowrap' : 'text-left')}
                                    >
                                        <Cell
                                            value={row[column.key]}
                                            column={column}
                                            live={isNumericColumn(column) ? context.liveValue?.(node.id, 'rows', [index, column.key]) : undefined}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {!all && rows.length > UI_TABLE_ROWS && (
                <Button size="xs" variant="secondary" onClick={() => setAll(true)}>
                    {t('blocks.table.showAll', { total: formatNumber(rows.length) })}
                </Button>
            )}
        </div>
    );
}
