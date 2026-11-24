import type { UiProps } from '@adecore/intelligent-ui';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { uiNodeText } from '../node-text';
import type { UiRendererProps } from '../render-context';
import { UI_TONE_FILL } from '../tones';

/*
 * Words from somewhere else, read as written: a line of a log keeps its stars and underscores, and with
 * `mono` its line breaks too. The bar at the start edge wears the tone, which a screen reader hears as a word.
 */
export function QuoteRenderer({ node }: UiRendererProps<UiProps<'Quote'>>) {
    const { t } = useTranslation('agent-chat');
    const { tone, source, mono } = node.props;
    const shown = tone ?? 'neutral';

    return (
        <figure className="flex gap-3 rounded-xl bg-ui-tile px-3 py-2.5">
            <span aria-hidden className={clsx('w-0.75 shrink-0 rounded-full', UI_TONE_FILL[shown])} />
            <div className="flex min-w-0 flex-col gap-1">
                {shown !== 'neutral' && <span className="sr-only">{t(`blocks.event.tone.${shown}`)}</span>}
                <blockquote className={clsx('wrap-anywhere text-text', mono === true ? 'font-mono text-code whitespace-pre-wrap' : 'text-xs')}>
                    {uiNodeText(node).trim()}
                </blockquote>
                {source !== undefined && source !== '' && <figcaption className="text-2xs wrap-anywhere text-text-muted">{source}</figcaption>}
            </div>
        </figure>
    );
}
