import { createContext, useContext } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import type { UiProps } from '@adecore/intelligent-ui';
import { Button, Icon, KeyValueList, Pill, Tooltip } from '@adecore/ui';
import { formatBytes, formatDuration, formatMoment, formatNumber, formatPercent, formatRounded } from '@adecore/ui/format';
import { useBlockLocal } from '../block-local';
import { uiChildrenOf, uiWithUnit } from '../node-text';
import type { UiLiveValue, UiRendererProps } from '../render-context';
import { isNumericColumn, UI_TABLE_ROWS, uiTableCell, uiTableColumns, type UiTableCell, type UiTableColumn } from '../table-data';
import { UI_TONE_PILL } from '../tones';
import { UiFallbackPart } from '../UiFallbackPart';

/* EntityList draws a hairline between its rows from this many on. */
const DIVIDED_FROM = 7;

/* Up to this many entries an EntityList is a row of tiles; a longer one is a list in one tile. */
const TILED_UP_TO = 4;

const EntityTiles = createContext(false);

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

/* The arrow and the number say which way a value went; only a tone says whether that is good. The tag says the change, its tooltip from what. */
export function StatRenderer({ node, context }: UiRendererProps<UiProps<'Stat'>>) {
    const { t } = useTranslation('agent-chat');
    const { label, value, previous, unit, tone } = node.props;
    const live = context.liveValue?.(node.id, 'value');
    const change = previous === undefined ? null : value - previous;
    const arrow = change === null || change === 0 ? ArrowRight : change > 0 ? ArrowUp : ArrowDown;
    const from = previous === undefined ? '' : uiWithUnit(formatRounded(previous, 2), unit);
    // A change from zero has no percentage.
    const percent = change === null || previous === undefined || previous === 0 ? null : formatPercent(Math.abs((change / previous) * 100));
    const said = percent === null ? t('blocks.stat.from', { previous: from }) : t('blocks.stat.change', { change: percent, previous: from });

    return (
        <div className="flex min-w-0 flex-col items-start gap-1.5 rounded-xl bg-ui-tile p-3">
            <span className="max-w-full truncate text-2xs text-text-muted">{label}</span>
            <LiveFigure
                text={uiWithUnit(formatRounded(value, 2), unit)}
                previous={typeof live?.previous === 'number' ? uiWithUnit(formatRounded(live.previous, 2), unit) : undefined}
                live={live}
                className="max-w-full truncate text-lg font-semibold tabular-nums"
            />
            {change !== null && (
                <Tooltip label={said}>
                    <span tabIndex={0} className="max-w-full rounded-md">
                        <Pill
                            shape="tag"
                            size="sm"
                            tone={tone === undefined ? 'muted' : UI_TONE_PILL[tone]}
                            icon={<Icon icon={arrow} size={12} className="shrink-0" />}
                        >
                            <span aria-hidden className="tabular-nums">
                                {percent ?? from}
                            </span>
                            <span className="sr-only">{said}</span>
                        </Pill>
                    </span>
                </Tooltip>
            )}
        </div>
    );
}

export function EntityListRenderer({ node, children }: UiRendererProps<UiProps<'EntityList'>>) {
    const count = uiChildrenOf(node, 'Entry').length;

    if (count <= TILED_UP_TO) {
        return (
            <EntityTiles value>
                <div className="chat-ui-nodes grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">{children}</div>
            </EntityTiles>
        );
    }

    return (
        <KeyValueList.Root divided={count >= DIVIDED_FROM} className="chat-ui-nodes chat-ui-flat rounded-xl bg-ui-tile px-3 py-2">
            {children}
        </KeyValueList.Root>
    );
}

export function EntryRenderer({ node, children }: UiRendererProps<UiProps<'Entry'>>) {
    const tiled = useContext(EntityTiles);

    if (tiled) {
        return (
            <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-ui-tile px-3 py-2">
                <span className="truncate text-2xs text-text-muted">{node.props.label}</span>
                <span className="text-2xs font-semibold wrap-break-word text-text">{children}</span>
            </div>
        );
    }

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
            <div className="chat-ui-flat max-h-80 w-full overflow-auto rounded-xl bg-ui-tile px-1.5 pb-1.5">
                <table
                    aria-label={t('blocks.table.label', { columns: columns.map((column) => column.title).join(', ') })}
                    className={clsx(
                        'w-full border-separate border-spacing-0 text-xs tabular-nums',
                        '[&_tbody_tr:first-child_td:first-child]:rounded-tl-lg [&_tbody_tr:first-child_td:last-child]:rounded-tr-lg',
                        '[&_tbody_tr:last-child_td:first-child]:rounded-bl-lg [&_tbody_tr:last-child_td:last-child]:rounded-br-lg'
                    )}
                >
                    <thead className="sticky top-0 z-1 bg-ui-tile">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    scope="col"
                                    className={clsx(
                                        'h-8 px-2 text-2xs font-medium whitespace-nowrap text-text-muted',
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
                            <tr key={index}>
                                {columns.map((column, at) => (
                                    <td
                                        key={column.key}
                                        className={clsx(
                                            'h-9 bg-ui-inset px-2 text-text',
                                            index > 0 && 'border-t border-border-soft',
                                            at === 0 && 'font-medium',
                                            isNumericColumn(column) ? 'text-right whitespace-nowrap' : 'text-left'
                                        )}
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
