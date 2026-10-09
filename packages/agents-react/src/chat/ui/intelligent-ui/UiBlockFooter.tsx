import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Radio, TriangleAlert, Wrench } from 'lucide-react';
import { Icon, Spinner, Tooltip, useTickingText } from '@adecore/ui';
import { formatAgo, formatMoment } from '@adecore/ui/format';
import { uiReasonText } from './node-text';
import type { UiLiveStatus } from './render-context';
import { useLater } from './use-later';

/* Something the compiler repaired, such as a prop it dropped; never an error to a person. */
export interface UiBlockFix {
    code: string;
    message: string;
}

export interface UiBlockFooterProps {
    live?: UiLiveStatus | null;
    /* The label of the Choice that answered the block, and when, in milliseconds since the epoch. */
    answered?: { label: string; at: number } | null;
    fixes?: readonly UiBlockFix[];
    /* Why the whole block is drawn as its text, such as that it is too large. */
    shownAsText?: string | null;
}

const NO_FIXES: readonly UiBlockFix[] = [];
const READING_SPINNER_MS = 1000;

/* The one sign of a live block: what it reads, and when it last read it. A reading spins only after a second. */
function LivePart({ live }: { live: UiLiveStatus }) {
    const { t } = useTranslation('agent-chat');
    const slow = useLater(live.state === 'reading', READING_SPINNER_MS);
    const { readAt } = live;
    const fresh = live.state === 'fresh' || live.state === 'reading';
    const ago = useTickingText(() => {
        if (readAt === null) {
            return '';
        }
        const time = formatAgo(Date.now() - readAt);
        return fresh ? t('blocks.live.read', { time }) : time;
    });
    const source = live.source ?? live.sources[0] ?? '';
    const icon = slow ? (
        <Spinner size={12} />
    ) : live.state === 'failed' ? (
        <Icon icon={TriangleAlert} size={12} className="text-status-needs-you" />
    ) : live.state === 'refused' ? (
        <Icon icon={Lock} size={12} />
    ) : (
        <Icon icon={Radio} size={12} className="text-status-idle" />
    );
    const words =
        live.state === 'failed'
            ? t('blocks.live.failed', { source })
            : live.state === 'refused'
              ? t('blocks.live.refused', { source })
              : t('blocks.live.label');
    const reason = live.state === 'failed' || live.state === 'refused' ? uiReasonText(t, live.code, live.reason) : undefined;
    const hint = reason !== undefined ? reason : live.sources.length > 0 ? t('blocks.live.sources', { sources: live.sources.join(', ') }) : null;
    const body = (
        <span tabIndex={hint === null ? undefined : 0} className="flex items-center gap-1.5">
            {icon}
            <span>{words}</span>
            {readAt !== null && live.state !== 'refused' && (
                <>
                    <span aria-hidden>·</span>
                    <time dateTime={new Date(readAt).toISOString()}>
                        <span ref={ago} className="tabular-nums" />
                    </time>
                </>
            )}
            {readAt === null && fresh && (
                <>
                    <span aria-hidden>·</span>
                    <span>{t('blocks.live.notRead')}</span>
                </>
            )}
        </span>
    );
    return hint === null ? body : <Tooltip label={hint}>{body}</Tooltip>;
}

/*
 * The line under a block, only when it has something to say: live, answered, repaired or drawn as
 * text, in that order. A hairline of the soft border runs the full width of the card over it.
 */
export function UiBlockFooter({ live = null, answered = null, fixes = NO_FIXES, shownAsText = null }: UiBlockFooterProps) {
    const { t } = useTranslation('agent-chat');
    const [fixesOpen, setFixesOpen] = useState(false);
    const listId = useId();
    if (live === null && answered === null && fixes.length === 0 && shownAsText === null) {
        return null;
    }
    return (
        <div className="-mx-2.25 mt-2.25 -mb-2.25 flex flex-col gap-1.5 border-t border-border-soft px-4.25 py-2 text-xs text-text-faint">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {live !== null && <LivePart live={live} />}
                {answered !== null && (
                    <span className="flex items-center gap-1.5">
                        <span>{t('blocks.answered', { label: answered.label })}</span>
                        <span aria-hidden>·</span>
                        <time dateTime={new Date(answered.at).toISOString()}>{formatMoment(answered.at)}</time>
                    </span>
                )}
                {fixes.length > 0 && (
                    <button
                        type="button"
                        aria-expanded={fixesOpen}
                        aria-controls={listId}
                        className="flex items-center gap-1.5 rounded-sm hover:text-text-muted"
                        onClick={() => setFixesOpen(!fixesOpen)}
                    >
                        <Icon icon={Wrench} size={12} />
                        {t('blocks.fixes', { count: fixes.length })}
                    </button>
                )}
                {shownAsText !== null && (
                    <span className="flex items-center gap-1.5">
                        <span>{t('blocks.shownAsText')}</span>
                        <span aria-hidden>·</span>
                        <span>{shownAsText}</span>
                    </span>
                )}
            </div>
            {fixes.length > 0 && (
                <ul id={listId} hidden={!fixesOpen} className="flex flex-col gap-0.5 text-text-muted">
                    {fixes.map((fix, index) => (
                        <li key={index} className="flex gap-2">
                            <span className="shrink-0 font-mono">{fix.code}</span>
                            <span className="min-w-0">{fix.message}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
