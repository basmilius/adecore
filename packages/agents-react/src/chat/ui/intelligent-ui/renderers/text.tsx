import { useContext } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Circle, CircleCheck, CircleDot, CircleMinus, CircleX, type LucideIcon } from 'lucide-react';
import { parseUiEventTime, type UiProps } from '@adecore/intelligent-ui';
import { Icon, Meter, Pill, Spinner } from '@adecore/ui';
import { formatNumber, formatPercent } from '@adecore/ui/format';
import { UiHeadContext, type UiRenderContext, type UiRendererProps } from '../render-context';
import { uiEventTime, uiNodeLabel } from '../node-text';
import { UI_STEP_PILL, UI_TONE_FILL, UI_TONE_ICONS, UI_TONE_PILL, UI_TONE_SURFACE, UI_TONE_TEXT } from '../tones';

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
 * A tile in its tone; the badge stands under the title in the tone's color. The head of the block
 * carries its icon in a square of its own, a Summary further down is a subheading without one. The
 * icon is the ground's ink in the dark theme, where its tones are too light for white.
 */
export function SummaryRenderer({ node, children }: UiRendererProps<UiProps<'Summary'>>) {
    const headId = useContext(UiHeadContext);
    const head = headId === undefined || headId === node.id;
    const { tone, badge } = node.props;
    const shown = tone ?? 'neutral';

    return (
        <div className={clsx(ICON_ROW, tone === undefined ? 'bg-ui-tile' : UI_TONE_SURFACE[tone])}>
            {head && (
                <span aria-hidden className={clsx(ICON_SQUARE, 'text-accent-text dark:text-surface', UI_TONE_FILL[shown])}>
                    <Icon icon={UI_TONE_ICONS[shown]} size={16} />
                </span>
            )}
            <div className={ICON_TEXT}>
                <div className="text-base font-semibold text-balance wrap-break-word text-text">{children}</div>
                {badge !== undefined && badge !== '' && (
                    <p className={clsx('text-2xs font-medium wrap-anywhere', tone === undefined ? 'text-text-muted' : UI_TONE_TEXT[tone])}>{badge}</p>
                )}
            </div>
        </div>
    );
}

/* A quiet tile whatever its tone: only the square of its icon wears the tone. */
export function CalloutRenderer({ node, children }: UiRendererProps<UiProps<'Callout'>>) {
    const { tone, title } = node.props;

    return (
        <div className={clsx('chat-ui-flat bg-ui-tile text-xs', ICON_ROW)}>
            <span aria-hidden className={clsx(ICON_SQUARE, UI_TONE_SURFACE[tone], UI_TONE_TEXT[tone])}>
                <Icon icon={UI_TONE_ICONS[tone]} size={16} />
            </span>
            <div className={ICON_TEXT}>
                {title !== undefined && title !== '' && <div className="font-semibold text-text">{title}</div>}
                <div className="text-text-muted">{children}</div>
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

/* Without a value the progress is indeterminate; without a max the value is a percentage. */
export function ProgressRenderer({ node, children, context }: UiRendererProps<UiProps<'Progress'>>) {
    const { t } = useTranslation('agent-chat');
    const { value, max } = node.props;
    const limit = max ?? 100;

    const reading =
        value === undefined ? null : limit === 100 ? formatPercent(value) : t('blocks.progress.of', { value: formatNumber(value), max: formatNumber(limit) });

    const label = uiNodeLabel(node);

    return (
        <div className="chat-ui-flat flex flex-col gap-2 rounded-xl bg-ui-tile p-3">
            <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 text-text">{children}</span>
                {reading !== null ? (
                    <span className="shrink-0 text-text-muted tabular-nums">{reading}</span>
                ) : (
                    isLive(context) && <Spinner size={12} className="shrink-0 self-center text-text-faint" />
                )}
            </div>
            <Meter value={value ?? null} max={limit} label={label === '' ? t('blocks.progress.label') : label} valueText={reading ?? undefined} />
        </div>
    );
}

export function StepsRenderer({ children }: UiRendererProps<UiProps<'Steps'>>) {
    return <ol className="chat-ui-nodes flex flex-col gap-1.5">{children}</ol>;
}

/* A tile per step with its state in words at the end. A running step spins only while the block is live; in a quiet block it is a still dot. */
export function StepRenderer({ node, children, context }: UiRendererProps<UiProps<'Step'>>) {
    const { t } = useTranslation('agent-chat');
    const { state, detail } = node.props;
    const quiet = state === 'pending' || state === 'skipped';

    return (
        <li className="flex min-h-10 items-start gap-3 rounded-xl bg-ui-tile px-3 py-2.5 text-xs">
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
            {/* A short detail stays beside the title; one that does not fit beside it takes the line under it. */}
            <span className="flex min-w-0 grow flex-wrap items-baseline gap-x-2">
                <span className={clsx('max-w-full min-w-0 font-medium wrap-break-word', quiet ? 'text-text-muted' : 'text-text')}>{children}</span>
                {detail !== undefined && detail !== '' && <span className="max-w-full text-2xs wrap-anywhere text-text-muted tabular-nums">{detail}</span>}
            </span>
            <Pill shape="tag" size="sm" tone={UI_STEP_PILL[state]} className="shrink-0">
                {t(`blocks.step.${state}`)}
            </Pill>
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
