import type { UiProps, UiTone } from '@adecore/intelligent-ui';
import { Button, Icon, KeyValueList, Pill, ScrollArea, Tooltip } from '@adecore/ui';
import { formatBytes, formatDuration, formatMoment, formatNumber, formatPercent, formatRounded } from '@adecore/ui/format';
import clsx from 'clsx';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { createContext, useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlockLocal } from '../block-local';
import { uiChildrenOf, uiNodeLabel, uiWithUnit } from '../node-text';
import type { UiLiveValue, UiRendererProps } from '../render-context';
import {
    isNumericColumn,
    UI_TABLE_ROWS,
    uiTableCell,
    uiTableColumns,
    uiTableOrder,
    uiTableSort,
    type UiTableCell,
    type UiTableColumn,
    type UiTableSort
} from '../table-data';
import { UI_TONE_PILL, UI_TONE_TEXT } from '../tones';
import { UiFallbackPart } from '../UiFallbackPart';

/* EntityList draws a hairline between its rows from this many on. */
const DIVIDED_FROM = 7;

/* Up to this many entries an EntityList is a row of tiles; a longer one is a list in one tile. */
const TILED_UP_TO = 4;

const EntityTiles = createContext(false);

/*
 * A value that live readings keep up to date. Keyed by its text, so a value that changed mounts
 * again and lights up once, even when it changes again before the last light settled. A stale
 * value is dimmed by the node around it, not here.
 */
function LiveFigure({
    text,
    previous,
    live,
    className,
    children
}: {
    text: string;
    previous?: string;
    live?: UiLiveValue;
    className?: string;
    /* What to draw for `text`, where it is more than the text itself. */
    children?: ReactNode;
}) {
    const lit = live !== undefined && live.changed && !live.stale && previous !== text;

    return (
        <span key={text} className={clsx(lit && 'chat-ui-changed', className) || undefined}>
            {children ?? text}
        </span>
    );
}

export function StatsRenderer({ children }: UiRendererProps<UiProps<'Stats'>>) {
    return <div className="chat-ui-nodes grid grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-2">{children}</div>;
}

const TREND_WIDTH = 100;
const TREND_HEIGHT = 24;
/* Room above and below the line, so its round ends are not cut at the highest and the lowest point. */
const TREND_PAD = 2;

/* The course of a value as one line over the width of its tile, on a scale of its own; a course that never moves is a level line. */
function TrendLine({ points, label, className }: { points: readonly number[]; label: string; className: string }) {
    const low = Math.min(...points);
    const span = Math.max(...points) - low;

    const path = points
        .map((point, index) => {
            const x = (index / (points.length - 1)) * TREND_WIDTH;
            const y = span === 0 ? TREND_HEIGHT / 2 : TREND_PAD + (1 - (point - low) / span) * (TREND_HEIGHT - 2 * TREND_PAD);

            return `${index === 0 ? 'M' : 'L'}${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
        })
        .join(' ');

    return (
        <svg role="img" aria-label={label} viewBox={`0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`} preserveAspectRatio="none" className={clsx('h-6 w-full', className)}>
            <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

/*
 * The arrow and the sign say which way a value went; only a tone says whether that is good. The change
 * stands at the end of the value's line, with what it changed from in its tooltip. A value in words
 * stands as written and compares with nothing.
 */
export function StatRenderer({ node, context }: UiRendererProps<UiProps<'Stat'>>) {
    const { t } = useTranslation('agent-chat');
    const { label, value, previous, unit, tone, trend } = node.props;
    const live = context.liveValue?.(node.id, 'value');
    // A percent sign hugs its number; any other unit stands apart from it, smaller.
    const apart = typeof value === 'number' && unit !== undefined && unit !== '' && unit !== '%';
    const withUnit = (number: number): string => uiWithUnit(formatRounded(number, 2), unit);
    const figureOf = (number: number): string => (apart ? formatRounded(number, 2) : withUnit(number));
    const change = previous === undefined || typeof value !== 'number' ? null : value - previous;
    const arrow = change === null || change === 0 ? ArrowRight : change > 0 ? ArrowUp : ArrowDown;
    const from = previous === undefined ? '' : withUnit(previous);
    // A change from zero has no percentage.
    const percent = change === null || previous === undefined || previous === 0 ? null : formatPercent(Math.abs((change / previous) * 100));
    const said = percent === null ? t('blocks.stat.from', { previous: from }) : t('blocks.stat.change', { change: percent, previous: from });
    const sign = change === null || change === 0 ? '' : change > 0 ? '+' : '-';

    return (
        <div className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-ui-tile p-3">
            <span className="max-w-full truncate text-2xs text-text-muted">{label}</span>
            <div className="flex min-w-0 items-baseline gap-1.5">
                <LiveFigure
                    text={typeof value === 'number' ? figureOf(value) : value}
                    previous={typeof live?.previous === 'number' ? figureOf(live.previous) : undefined}
                    live={live}
                    className="min-w-0 truncate text-lg font-semibold text-text tabular-nums"
                />
                {apart && <span className="max-w-1/2 shrink-0 truncate text-xs text-text-muted">{unit}</span>}
                {change !== null && (
                    <Tooltip label={said}>
                        <span
                            tabIndex={0}
                            className={clsx(
                                'ml-auto flex shrink-0 items-center gap-0.5 rounded-sm text-2xs font-semibold tabular-nums',
                                UI_TONE_TEXT[tone ?? 'neutral']
                            )}
                        >
                            <Icon icon={arrow} size={12} className="shrink-0" />
                            <span aria-hidden>{percent === null ? from : `${sign}${percent}`}</span>
                            <span className="sr-only">{said}</span>
                        </span>
                    </Tooltip>
                )}
            </div>
            {trend !== undefined && (
                <TrendLine
                    points={trend}
                    label={t('blocks.stat.trend', { first: withUnit(trend[0]!), last: withUnit(trend.at(-1)!) })}
                    className={UI_TONE_TEXT[tone ?? 'neutral']}
                />
            )}
        </div>
    );
}

/* Tiles up to four entries and a list from five, unless `layout` says which. */
export function EntityListRenderer({ node, children }: UiRendererProps<UiProps<'EntityList'>>) {
    const count = uiChildrenOf(node, 'Entry').length;
    const { layout } = node.props;

    if (layout === undefined ? count <= TILED_UP_TO : layout === 'tiles') {
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
    const value = entryValue(node.props, uiNodeLabel(node)) ?? children;

    if (tiled) {
        return (
            <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-ui-tile px-3 py-2">
                <span className="truncate text-2xs text-text-muted">{node.props.label}</span>
                <span className="text-2xs font-semibold wrap-break-word text-text">{value}</span>
            </div>
        );
    }

    return (
        <KeyValueList.Item>
            <KeyValueList.Name>{node.props.label}</KeyValueList.Name>
            <KeyValueList.Value>{value}</KeyValueList.Value>
        </KeyValueList.Item>
    );
}

function numberText(cell: Extract<UiTableCell, { kind: 'number' }>, unit: string | undefined): string {
    switch (cell.as) {
        case 'bytes':
            return formatBytes(cell.value);
        case 'duration':
            return formatDuration(cell.value);
        case 'percent':
            return formatPercent(cell.value);
        case 'number':
            return uiWithUnit(formatRounded(cell.value, 2), unit);
    }
}

/* What a cell reads as, so two readings that draw the same do not light up. */
function cellText(cell: UiTableCell, column: UiTableColumn): string {
    switch (cell.kind) {
        case 'empty':
            return '';
        case 'text':
        case 'tag':
            return cell.text;
        case 'number':
            return numberText(cell, column.unit);
        case 'date':
            return formatMoment(cell.at);
        case 'file':
            return cell.path;
    }
}

/* The tone a column gives a tag by its text; a text the column does not name stays quiet. */
function tagTone(text: string, column: UiTableColumn): UiTone | undefined {
    return column.tones !== undefined && Object.hasOwn(column.tones, text) ? column.tones[text] : undefined;
}

function cellContent(cell: Exclude<UiTableCell, { kind: 'empty' }>, column: UiTableColumn): ReactNode {
    switch (cell.kind) {
        case 'text':
            return cell.text;
        case 'number':
            return numberText(cell, column.unit);
        case 'date':
            return <time dateTime={new Date(cell.at).toISOString()}>{formatMoment(cell.at)}</time>;
        case 'file':
            // A cell is no link target the host checked, so its path stays text.
            return <span className="font-mono text-code break-all">{cell.path}</span>;
        case 'tag': {
            const tone = tagTone(cell.text, column);

            return (
                <Pill shape="tag" size="sm" tone={tone === undefined ? 'muted' : UI_TONE_PILL[tone]}>
                    {cell.text}
                </Pill>
            );
        }
    }
}

/* The value of an Entry drawn as a table cell of its kind, or null where it stands as written: without a kind, and for text the kind cannot read. */
function entryValue({ label, as }: UiProps<'Entry'>, written: string): ReactNode {
    if (as === undefined || as === 'text') {
        return null;
    }

    const column: UiTableColumn = { key: 'value', title: label, as };
    // A date in milliseconds arrives here as its digits, which a table would get as a number.
    const cell = uiTableCell(as === 'date' && /^\d+$/.test(written) ? Number(written) : written, column);

    return cell.kind === 'empty' || cell.kind === 'text' ? null : cellContent(cell, column);
}

function Cell({ value, column, live }: { value: unknown; column: UiTableColumn; live?: UiLiveValue }) {
    const cell = uiTableCell(value, column);

    if (cell.kind === 'empty') {
        return null;
    }

    const text = cellText(cell, column);
    const previous = live?.previous === undefined ? undefined : cellText(uiTableCell(live.previous, column), column);

    return (
        <LiveFigure text={text} previous={previous} live={live}>
            {cellContent(cell, column)}
        </LiveFigure>
    );
}

/*
 * Rows under a sticky head, scrolling inside 320px and sideways when wider than the column. Rows
 * arrive one by one while the block streams, without animation; past fifty a person asks for the rest.
 * A head sorts by its column, from the order `sort` asked for until a person picks one.
 */
export function TableRenderer({ node, context }: UiRendererProps<UiProps<'Table'>>) {
    const { t } = useTranslation('agent-chat');
    const [all, setAll] = useBlockLocal(context, node.id, () => false);
    const [picked, setPicked] = useBlockLocal<UiTableSort | null>(context, `${node.id}:sort`, () => null);
    const columns = uiTableColumns(node);

    if (columns.length === 0) {
        return <UiFallbackPart fallback={node.fallback} problem={{ kind: 'failed' }} />;
    }

    const { rows } = node.props;
    const sort = picked !== null && columns.some((column) => column.key === picked.key) ? picked : uiTableSort(node.props.sort, columns);
    const sorted = columns.find((column) => column.key === sort?.key);
    // A row keeps its place in `rows` whatever the order: live readings address it by that.
    const order = sorted === undefined || sort === null ? rows.map((_, index) => index) : uiTableOrder(rows, sorted, sort.descending);
    const shown = all ? order : order.slice(0, UI_TABLE_ROWS);

    return (
        <div className="flex flex-col items-start gap-1.5">
            {/* Flat on both parts: a section drops the frame's ground and the viewport's padding.
                A wheel at the table's end goes on to the thread, which a bounce in the table would swallow. */}
            <ScrollArea
                axis="both"
                className="chat-ui-flat max-h-80 w-full rounded-xl bg-ui-tile"
                viewportClassName="chat-ui-flat overscroll-y-auto px-1.5 pb-1.5"
            >
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
                            {columns.map((column) => {
                                const descending = sort?.key === column.key ? sort.descending : null;

                                return (
                                    <th
                                        key={column.key}
                                        scope="col"
                                        aria-sort={descending === null ? undefined : descending ? 'descending' : 'ascending'}
                                        className={clsx(
                                            'h-8 px-2 text-2xs font-medium whitespace-nowrap',
                                            isNumericColumn(column) ? 'text-right' : 'text-left'
                                        )}
                                    >
                                        <button
                                            type="button"
                                            // The arrow stands on the side away from the cells, so a title stays in line with its column.
                                            className={clsx(
                                                'inline-flex items-center gap-1 rounded-sm text-left hover:text-text',
                                                descending === null ? 'text-text-muted' : 'text-text',
                                                isNumericColumn(column) && 'flex-row-reverse'
                                            )}
                                            onClick={() => setPicked({ key: column.key, descending: descending === false })}
                                        >
                                            {column.title}
                                            {descending !== null && <Icon icon={descending ? ArrowDown : ArrowUp} size={12} className="shrink-0" />}
                                        </button>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((index, place) => (
                            // Rows only ever grow at the end while a block streams, so the place of a row in `rows` is a stable key.
                            <tr key={index}>
                                {columns.map((column, at) => (
                                    <td
                                        key={column.key}
                                        className={clsx(
                                            'h-9 bg-ui-inset px-2 text-text',
                                            place > 0 && 'border-t border-border-soft',
                                            at === 0 && 'font-medium',
                                            isNumericColumn(column) ? 'text-right whitespace-nowrap' : 'text-left'
                                        )}
                                    >
                                        <Cell
                                            value={rows[index]![column.key]}
                                            column={column}
                                            live={context.liveValue?.(node.id, 'rows', [index, column.key])}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </ScrollArea>
            {!all && rows.length > UI_TABLE_ROWS && (
                <Button size="xs" variant="secondary" onClick={() => setAll(true)}>
                    {t('blocks.table.showAll', { total: formatNumber(rows.length) })}
                </Button>
            )}
        </div>
    );
}
