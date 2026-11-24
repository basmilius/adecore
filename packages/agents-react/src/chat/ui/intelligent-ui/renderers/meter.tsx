import type { UiProps } from '@adecore/intelligent-ui';
import { Icon, Meter, SegmentBar } from '@adecore/ui';
import { formatPercent, formatRounded } from '@adecore/ui/format';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { uiChildrenOf, uiNodeLabel, uiWithUnit } from '../node-text';
import type { UiRendererProps } from '../render-context';
import { UI_TONE_COLOR, UI_TONE_ICONS, UI_TONE_TEXT } from '../tones';

/*
 * A value against its limit, unlike Progress no word on work that runs. The tone colors the reading and
 * gives it the tone's icon; the bar stays the accent. Without a max the value stands alone, as a
 * percentage would.
 */
export function MeterRenderer({ node, children }: UiRendererProps<UiProps<'Meter'>>) {
    const { t } = useTranslation('agent-chat');
    const { value, max, mark, unit, tone, detail } = node.props;
    const figure = uiWithUnit(formatRounded(value, 2), unit);
    const limit = max === undefined ? null : uiWithUnit(formatRounded(max, 2), unit);
    const toned = tone !== undefined && tone !== 'neutral';
    const label = uiNodeLabel(node);

    const said = [
        limit === null ? figure : t('blocks.meter.reading', { value: figure, max: limit }),
        mark === undefined ? '' : t('blocks.meter.mark', { mark: uiWithUnit(formatRounded(mark, 2), unit) }),
        toned ? t(`blocks.event.tone.${tone}`) : ''
    ]
        .filter((part) => part !== '')
        .join(', ');

    return (
        <div className="chat-ui-flat flex flex-col gap-2 rounded-xl bg-ui-tile p-3">
            <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 text-text-muted">{children}</span>
                {/* The meter under it says the same to a screen reader, with the mark and the tone in words. */}
                <span aria-hidden className="flex shrink-0 items-baseline gap-1 tabular-nums">
                    {toned && <Icon icon={UI_TONE_ICONS[tone]} size={12} className={clsx('self-center', UI_TONE_TEXT[tone])} />}
                    <span className={clsx('font-semibold', toned ? UI_TONE_TEXT[tone] : 'text-text')}>{figure}</span>
                    {limit !== null && <span className="text-text-muted">{t('blocks.meter.of', { max: limit })}</span>}
                </span>
            </div>
            <Meter
                value={value}
                max={max ?? 100}
                marks={mark === undefined ? undefined : [mark]}
                label={label === '' ? t('blocks.meter.label') : label}
                valueText={said}
            />
            {detail !== undefined && detail !== '' && <p className="text-2xs wrap-anywhere text-text-muted">{detail}</p>}
        </div>
    );
}

/* The most parts one bar holds, which is as many colors as the chart palette has. */
const PARTS = 6;

/*
 * One bar divided by the values of its parts, and under it what each part is and its share. A part
 * wears the next color of the chart palette, or its tone. The bar is the list a screen reader hears,
 * with every value in it; the legend repeats it for the eye.
 */
export function PartsRenderer({ node }: UiRendererProps<UiProps<'Parts'>>) {
    const { t } = useTranslation('agent-chat');
    const { unit } = node.props;
    const children = uiChildrenOf(node, 'Part').slice(0, PARTS);
    const total = children.reduce((sum, part) => sum + part.props.value, 0);

    const parts = children.map((part, index) => {
        const { value, tone } = part.props;
        const share = formatPercent(total > 0 ? (value / total) * 100 : 0);
        const name = uiNodeLabel(part);

        return {
            id: part.id,
            name,
            share,
            value,
            color: tone === undefined ? `var(--chart-${index + 1})` : UI_TONE_COLOR[tone],
            said: t('blocks.parts.part', { label: name, value: uiWithUnit(formatRounded(value, 2), unit), share })
        };
    });

    return (
        <div className="chat-ui-flat flex flex-col gap-2.5 rounded-xl bg-ui-tile p-3">
            {total > 0 ? (
                <SegmentBar
                    size="sm"
                    label={t('blocks.parts.label')}
                    parts={parts.filter((part) => part.value > 0).map((part) => ({ value: part.value, label: part.said, color: part.color }))}
                />
            ) : (
                <div aria-hidden className="h-1.5 rounded-full bg-track" />
            )}
            <ul aria-hidden={total > 0 || undefined} className="flex flex-wrap gap-x-4 gap-y-1 text-2xs">
                {parts.map((part) => (
                    <li key={part.id} className="flex min-w-0 items-center gap-1.5">
                        <span className="size-2 shrink-0 rounded-xs" style={{ backgroundColor: part.color }} />
                        <span className="min-w-0 truncate text-text-muted">{part.name}</span>
                        <span className="shrink-0 font-semibold text-text tabular-nums">{part.share}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
