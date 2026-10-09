import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import type { UiProps } from '@adecore/intelligent-ui';
import { Button, Icon, KeyValueList, Pill } from '@adecore/ui';
import { formatBytes, formatDuration, formatMoment, formatNumber, formatPercent, formatRounded } from '@adecore/ui/format';
import { useBlockLocal } from '../block-local';
import { uiChildrenOf } from '../node-text';
import type { UiRenderContext, UiRendererProps } from '../render-context';
import { isNumericColumn, UI_TABLE_ROWS, uiTableCell, uiTableColumns, type UiTableColumn } from '../table-data';
import { UI_TONE_TEXT } from '../tones';
import { UiFallbackPart } from '../UiFallbackPart';
import { UiLinkChip } from './links';

/* EntityList draws a hairline between its rows from this many on. */
const DIVIDED_FROM = 7;

/* A number with its unit, where a percent sign hugs the number and every other unit stands apart from it. */
function withUnit(text: string, unit: string | undefined): string {
    if (unit === undefined || unit === '') {
        return text;
    }
    return unit === '%' ? `${text}${unit}` : `${text} ${unit}`;
}

export function StatsRenderer({ children }: UiRendererProps<UiProps<'Stats'>>) {
    return <div className="chat-ui-nodes grid grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-2">{children}</div>;
}

/* The arrow and the number say which way a value went; only a tone says whether that is good. */
export function StatRenderer({ node }: UiRendererProps<UiProps<'Stat'>>) {
    const { t } = useTranslation('agent-chat');
    const { label, value, previous, unit, tone } = node.props;
    const change = previous === undefined ? null : value - previous;
    const arrow = change === null || change === 0 ? ArrowRight : change > 0 ? ArrowUp : ArrowDown;
    const from = previous === undefined ? '' : withUnit(formatRounded(previous, 2), unit);
    // A change from zero has no percentage.
    const percent = change === null || previous === undefined || previous === 0 ? null : formatPercent(Math.abs((change / previous) * 100));
    return (
        <div className="flex min-w-0 flex-col gap-0.5 rounded-md bg-surface-hover px-2 py-1.5">
            <span className="truncate text-xs text-text-muted">{label}</span>
            <span className="text-lg font-semibold text-text tabular-nums">{withUnit(formatRounded(value, 2), unit)}</span>
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

function Cell({ value, column, context }: { value: unknown; column: UiTableColumn; context: UiRenderContext }) {
    const cell = uiTableCell(value, column);
    switch (cell.kind) {
        case 'empty':
            return null;
        case 'text':
            return <>{cell.text}</>;
        case 'number':
            return (
                <>
                    {cell.as === 'bytes'
                        ? formatBytes(cell.value)
                        : cell.as === 'duration'
                          ? formatDuration(cell.value)
                          : withUnit(formatRounded(cell.value, 2), column.unit)}
                </>
            );
        case 'date':
            return <time dateTime={new Date(cell.at).toISOString()}>{formatMoment(cell.at)}</time>;
        case 'file':
            return <UiLinkChip target={{ type: 'File', path: cell.path }} context={context} />;
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
                <table className="w-full border-collapse text-xs tabular-nums">
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
                                        <Cell value={row[column.key]} column={column} context={context} />
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
