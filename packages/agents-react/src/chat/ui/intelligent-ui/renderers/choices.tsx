import { useId, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { uiChoiceLabel, type UiProps } from '@adecore/intelligent-ui';
import { DisabledReason, formatShortcut, Icon, KEY_SHORTCUTS, Spinner, Tooltip } from '@adecore/ui';
import { useChatHost } from '../../../../host';
import type { UiRendererProps } from '../render-context';
import { UiFallbackPart } from '../UiFallbackPart';
import { useLater } from '../use-later';

/* A context this long may run past its two lines, so the row offers all of it in a tooltip. */
const LONG_CONTEXT = 120;
const SPINNER_AFTER_MS = 300;

/* Says once, politely, that the choices opened when the reply was done; never on a block that was already done. */
export function ChoicesRenderer({ children, context }: UiRendererProps<UiProps<'Choices'>>) {
    const { t } = useTranslation('agent-chat');
    const [streamed] = useState(context.phase === 'streaming');

    return (
        <div role="group" aria-label={t('blocks.choices')} className="chat-ui-nodes @container flex flex-wrap items-start gap-2">
            {children}
            <span className="sr-only" role="status">
                {streamed && context.phase === 'final' ? t('blocks.choice.ready') : ''}
            </span>
        </div>
    );
}

/*
 * A button that shows what it sends: the label, and under it the context the agent receives. It stays
 * closed while the reply streams, once the block is answered and without a host to send it, and
 * remains focusable then so a screen reader hears why. A finished Choice the host would refuse for
 * its label is no button at all, but its text. The primary one says the key that picks it while the
 * focus is in the block (`UiBlockFrame`).
 */
export function ChoiceRenderer({ node, children, context }: UiRendererProps<UiProps<'Choice'>>) {
    const { t } = useTranslation('agent-chat');
    const host = useChatHost();
    const descriptionId = useId();
    const { context: detail, primary, disabled } = node.props;
    const { answer, onChoose } = context;
    const chosen = answer !== null && answer.choiceId === node.id;
    const waiting = context.phase === 'streaming';
    const unavailable = disabled === true || onChoose === undefined;
    const failed = answer === null && context.failedChoiceId === node.id;
    const closed = waiting || unavailable || answer !== null;
    const slow = useLater(chosen && answer.state === 'sending', SPINNER_AFTER_MS);

    if (!waiting && uiChoiceLabel(node) === null) {
        return <UiFallbackPart fallback={node.fallback} problem={{ kind: 'failed' }} />;
    }

    const reason = waiting
        ? t('blocks.choice.waiting')
        : answer === null && unavailable
          ? ((disabled === true ? null : context.choiceReason) ?? t('blocks.choice.unavailable'))
          : null;

    const described = detail !== undefined && detail !== '';
    const strong = primary === true;

    const button = (
        <button
            type="button"
            aria-disabled={closed || undefined}
            aria-describedby={described ? descriptionId : undefined}
            aria-keyshortcuts={strong && !closed ? 'Meta+Enter Control+Enter' : undefined}
            data-ui-primary-choice={strong && !closed ? '' : undefined}
            className={clsx(
                'flex max-w-full min-h-9.5 items-center gap-2.5 rounded-xl px-4 py-2 text-left text-xs transition-[opacity,scale,background-color,filter] duration-150 motion-reduce:transition-none',
                strong ? 'bg-accent text-accent-text' : 'bg-ui-tile text-text',
                chosen && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
                failed && 'ring-2 ring-status-error',
                !closed && (strong ? 'hover:brightness-110' : 'hover:bg-surface-active'),
                !closed && 'active:scale-99',
                waiting ? 'opacity-60' : closed && !chosen && 'opacity-50'
            )}
            onClick={() => {
                if (!closed) {
                    onChoose?.(node.id);
                }
            }}
        >
            <span className="flex min-w-0 flex-col">
                <span className={clsx('wrap-anywhere', strong ? 'font-semibold' : 'font-medium')}>{children}</span>
                {described && (
                    <span id={descriptionId} className={clsx('line-clamp-2 text-2xs wrap-anywhere', strong ? 'text-accent-text/80' : 'text-text-muted')}>
                        {detail}
                    </span>
                )}
            </span>
            {strong && !closed && (
                <kbd aria-hidden className="shrink-0 rounded-md bg-accent-text/18 px-1.5 font-sans text-2xs font-medium">
                    {formatShortcut(KEY_SHORTCUTS.modEnter, host.isApplePlatform())}
                </kbd>
            )}
            {chosen && (
                <span className={clsx('flex shrink-0 items-center gap-1 text-2xs', strong ? 'text-accent-text' : 'text-accent')}>
                    {slow ? <Spinner size={12} /> : <Icon icon={Check} size={12} />}
                    {answer.state === 'queued' ? t('blocks.choice.queued') : t('blocks.choice.sent')}
                </span>
            )}
        </button>
    );

    // At most half the row less half the gap, so two long choices stand side by side and end on one edge; a narrow block gives each the row.
    return (
        <div className="flex max-w-full flex-col gap-1 @min-[420px]:max-w-[calc(50%-4px)]">
            {reason !== null ? (
                <DisabledReason reason={reason}>{button}</DisabledReason>
            ) : described && detail.length > LONG_CONTEXT ? (
                <Tooltip label={detail}>{button}</Tooltip>
            ) : (
                button
            )}
            {failed && (
                <p role="alert" className="px-1 text-2xs text-status-error">
                    {t('blocks.choice.failed')}
                </p>
            )}
        </div>
    );
}
