import { parseUiEventTime, type UiProps } from '@adecore/intelligent-ui';
import { Icon, Meter, Pill, Spinner } from '@adecore/ui';
import { formatNumber, formatPercent } from '@adecore/ui/format';
import clsx from 'clsx';
import { Circle, CircleCheck, CircleDot, CircleMinus, CircleX, type LucideIcon } from 'lucide-react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { uiEventTime, uiNodeLabel } from '../node-text';
import { UiHeadContext, type UiRenderContext, type UiRendererProps } from '../render-context';
import { UI_TONE_FILL, UI_TONE_ICONS, UI_TONE_PILL, UI_TONE_SURFACE, UI_TONE_TEXT } from '../tones';

type StepState = UiProps<'Step'>['state'];

const STEP_ICONS: Readonly<Record<Exclude<StepState, 'running'>, LucideIcon>> = {
    done: CircleCheck,
    pending: Circle,
    failed: CircleX,
    skipped: CircleMinus
};

const STEP_TONES: Readonly<Record<StepState, string>> = {
    done: 'text-status-idle',
    running: 'text-accent',
    pending: 'text-text-faint',
    failed: 'text-status-error',
    skipped: 'text-text-faint'
};

/* A detail longer than this reads as a sentence, which a tag cannot wrap. */
const DETAIL_AS_TAG = 24;

/* Whether the block still changes: while it streams, or while it reads live data. Only then does anything spin. */
function isLive(context: UiRenderContext): boolean {
    return context.phase === 'streaming' || (context.live !== undefined && context.live !== null && context.live.state !== 'refused');
}

/* A Summary and a Callout share one row: the icon in a square, and beside it text that centers on the square while it is shorter and starts at its top once it is taller. */
const ICON_ROW = 'flex items-start gap-3 rounded-xl p-3';
const ICON_SQUARE = 'grid size-8.5 shrink-0 place-items-center rounded-lg';
const ICON_TEXT = 'flex min-h-8.5 min-w-0 grow flex-col justify-center gap-0.5';

/*
 * A tile in its tone. A short badge is a tag at the end of the row; a longer one stands under the
 * title, since a tag cannot wrap. The head of the block carries its icon in a square of its own, a
 * Summary further down is a subheading without one. The icon is the ground's ink in the dark theme,
 * where its tones are too light for white.
 */
export function SummaryRenderer({ node, children }: UiRendererProps<UiProps<'Summary'>>) {
    const headId = useContext(UiHeadContext);
    const head = headId === undefined || headId === node.id;
    const { tone, badge, detail } = node.props;
    const shown = tone ?? 'neutral';
    const badged = badge !== undefined && badge !== '';
    const tagged = badged && badge.length <= DETAIL_AS_TAG;

    return (
        <div className={clsx(ICON_ROW, tone === undefined ? 'bg-ui-tile' : UI_TONE_SURFACE[tone])}>
            {head && (
                <span aria-hidden className={clsx(ICON_SQUARE, 'text-accent-text dark:text-surface', UI_TONE_FILL[shown])}>
                    <Icon icon={UI_TONE_ICONS[shown]} size={16} />
                </span>
            )}
            <div className={ICON_TEXT}>
                <div className="text-base font-semibold text-balance wrap-break-word text-text">{children}</div>
                {/* Muted text does not reach 4.5 to 1 on the surface of a tone, so the detail is muted only on the gray tile. */}
                {detail !== undefined && detail !== '' && (
                    <p className={clsx('text-xs wrap-break-word', tone === undefined ? 'text-text-muted' : 'text-text')}>{detail}</p>
                )}
                {badged && !tagged && (
                    <p className={clsx('text-2xs font-medium wrap-anywhere', tone === undefined ? 'text-text-muted' : UI_TONE_TEXT[tone])}>{badge}</p>
                )}
            </div>
            {tagged && (
                <Pill shape="tag" size="sm" tone={UI_TONE_PILL[shown]} className="mt-0.5 shrink-0">
                    {badge}
                </Pill>
            )}
        </div>
    );
}

/*
 * A quiet tile whose icon square wears the tone. A warning and a danger take the surface of their tone
 * for the whole tile, and keep it inside a Section, where a quiet tile goes flat. Their words are the full
 * text color: muted text does not reach 4.5 to 1 on a tinted surface.
 */
export function CalloutRenderer({ node, children }: UiRendererProps<UiProps<'Callout'>>) {
    const { tone, title } = node.props;
    const tinted = tone === 'warning' || tone === 'danger';

    return (
        <div className={clsx('text-xs', ICON_ROW, tinted ? UI_TONE_SURFACE[tone] : 'chat-ui-flat bg-ui-tile')}>
            <span aria-hidden className={clsx(ICON_SQUARE, UI_TONE_SURFACE[tone], UI_TONE_TEXT[tone])}>
                <Icon icon={UI_TONE_ICONS[tone]} size={16} />
            </span>
            <div className={ICON_TEXT}>
                {title !== undefined && title !== '' && <div className="font-semibold text-text">{title}</div>}
                <div className={tinted ? 'text-text' : 'text-text-muted'}>{children}</div>
            </div>
        </div>
    );
}

export function TagRenderer({ node, children }: UiRendererProps<UiProps<'Tag'>>) {
    const { tone } = node.props;

    return (
        <Pill shape="tag" size="sm" tone={tone === undefined ? 'muted' : UI_TONE_PILL[tone]}>
            {children}
        </Pill>
    );
}

/*
 * Without a value the progress is indeterminate; without a max the value is a percentage. The tone colors
 * the reading and gives it the tone's icon; the bar stays the accent.
 */
export function ProgressRenderer({ node, children, context }: UiRendererProps<UiProps<'Progress'>>) {
    const { t } = useTranslation('agent-chat');
    const { value, max, tone, detail } = node.props;
    const limit = max ?? 100;
    const toned = tone !== undefined && tone !== 'neutral';

    const reading =
        value === undefined ? null : limit === 100 ? formatPercent(value) : t('blocks.progress.of', { value: formatNumber(value), max: formatNumber(limit) });

    const said = [reading ?? '', toned ? t(`blocks.event.tone.${tone}`) : ''].filter((part) => part !== '').join(', ');
    const label = uiNodeLabel(node);

    return (
        <div className="chat-ui-flat flex flex-col gap-2 rounded-xl bg-ui-tile p-3">
            <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 text-text">{children}</span>
                {/* The meter under it says the same to a screen reader, with the tone in words. */}
                <span aria-hidden className="flex shrink-0 items-baseline gap-1 tabular-nums">
                    {toned && <Icon icon={UI_TONE_ICONS[tone]} size={12} className={clsx('self-center', UI_TONE_TEXT[tone])} />}
                    {reading !== null ? (
                        <span className={toned ? UI_TONE_TEXT[tone] : 'text-text-muted'}>{reading}</span>
                    ) : (
                        isLive(context) && <Spinner size={12} className="self-center text-text-faint" />
                    )}
                </span>
            </div>
            <Meter value={value ?? null} max={limit} label={label === '' ? t('blocks.progress.label') : label} valueText={said === '' ? undefined : said} />
            {detail !== undefined && detail !== '' && <p className="text-2xs wrap-anywhere text-text-muted">{detail}</p>}
        </div>
    );
}

export function StepsRenderer({ children }: UiRendererProps<UiProps<'Steps'>>) {
    return <ol className="chat-ui-nodes chat-ui-flat flex flex-col rounded-xl bg-ui-tile p-3">{children}</ol>;
}

/*
 * A row of the sequence's tile: the state as an icon on a rail that runs to the next step, the label, and
 * the detail at the end, or under the label once it does not fit beside it. Only a failed step says its
 * state in sight; every other one says it to a screen reader. A running step spins only while the block
 * is live; in a quiet block it is a still dot.
 */
export function StepRenderer({ node, children, context }: UiRendererProps<UiProps<'Step'>>) {
    const { t } = useTranslation('agent-chat');
    const { state, detail } = node.props;
    const quiet = state === 'pending' || state === 'skipped';

    return (
        <li className="group flex items-stretch gap-3 text-xs">
            <span className="flex w-4 shrink-0 flex-col items-center">
                <span className={clsx('mt-0.5 grid size-4 shrink-0 place-items-center', STEP_TONES[state])}>
                    {state === 'running' ? (
                        isLive(context) ? (
                            <Spinner size={14} />
                        ) : (
                            <Icon icon={CircleDot} size={14} />
                        )
                    ) : (
                        <Icon icon={STEP_ICONS[state]} size={14} />
                    )}
                </span>
                <span aria-hidden className="my-1 w-px grow bg-border group-last:hidden" />
            </span>
            <span className="flex min-w-0 grow flex-col gap-0.5 pb-3 group-last:pb-0">
                <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
                    <span className={clsx('max-w-full min-w-0 font-medium wrap-break-word', quiet ? 'text-text-muted' : 'text-text')}>{children}</span>
                    {detail !== undefined && detail !== '' && <span className="max-w-full text-2xs wrap-anywhere text-text-muted tabular-nums">{detail}</span>}
                </span>
                <span className={state === 'failed' ? 'text-2xs text-status-error' : 'sr-only'}>{t(`blocks.step.${state}`)}</span>
            </span>
        </li>
    );
}

export function TimelineRenderer({ children }: UiRendererProps<UiProps<'Timeline'>>) {
    return <ol className="chat-ui-nodes chat-ui-flat flex flex-col rounded-xl bg-ui-tile px-3 py-1.5">{children}</ol>;
}

/* A row of the tile: the time, a dot in the tone, the title, and a short detail as a tag at the end or a longer one under the title. */
export function EventRenderer({ node, children }: UiRendererProps<UiProps<'Event'>>) {
    const { t } = useTranslation('agent-chat');
    const { at, detail } = node.props;
    const tone = node.props.tone ?? 'neutral';
    const time = uiEventTime(at);
    // A neutral dot says nothing the title does not, and a detail is part of what the row says.
    const label = [time, uiNodeLabel(node), tone === 'neutral' ? '' : t(`blocks.event.tone.${tone}`), detail ?? ''].filter((part) => part !== '').join(', ');
    const described = detail !== undefined && detail !== '';
    const tagged = described && detail.length <= DETAIL_AS_TAG;

    return (
        <li aria-label={label} className="flex min-h-9 items-start gap-3 py-2 text-xs">
            {/* A time nobody could read stays as written and is no `dateTime` for a machine to read. */}
            {parseUiEventTime(at) === null ? (
                <span className="w-24 shrink-0 text-2xs leading-5 wrap-anywhere text-text-muted tabular-nums">{time}</span>
            ) : (
                <time dateTime={at} className="w-24 shrink-0 text-2xs leading-5 text-text-muted tabular-nums">
                    {time}
                </time>
            )}
            <span aria-hidden className={clsx('mt-1.5 size-2 shrink-0 rounded-full bg-current', tone === 'neutral' ? 'text-text-faint' : UI_TONE_TEXT[tone])} />
            <div className="flex min-w-0 grow flex-col gap-0.5">
                <div className="wrap-break-word text-text">{children}</div>
                {described && !tagged && <div className="text-2xs wrap-anywhere text-text-muted">{detail}</div>}
            </div>
            {tagged && (
                <Pill shape="tag" size="sm" tone={UI_TONE_PILL[tone]} className="shrink-0">
                    {detail}
                </Pill>
            )}
        </li>
    );
}
