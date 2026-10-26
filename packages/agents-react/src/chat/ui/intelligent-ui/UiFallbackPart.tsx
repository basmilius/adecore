import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Icon } from '@adecore/ui';
import { Markdown } from '../Markdown';

/* Why a part is drawn as its text: a component this version does not know, or one it could not draw. */
export type UiFallbackProblem = { kind: 'unknown'; component: string } | { kind: 'failed' };

/*
 * One part of a block as the markdown it stands for, on a card in a quiet tile under a line that says why.
 * A person sees it as a repair, never as an error, so nothing here is red.
 */
export function UiFallbackPart({ fallback, problem }: { fallback: string; problem: UiFallbackProblem }) {
    const { t } = useTranslation('agent-chat');

    return (
        <div className="chat-ui-flat flex flex-col gap-1.5 rounded-xl bg-ui-tile p-1.5">
            <span className="chat-ui-flat-inner flex items-center gap-1.5 px-1.5 pt-0.5 text-2xs text-text-muted">
                <Icon icon={Info} size={12} className="shrink-0" />
                {problem.kind === 'unknown' ? t('blocks.unknownComponent', { component: problem.component }) : t('blocks.renderFailed')}
            </span>
            {fallback !== '' && (
                // A fallback is often data without a space in it, such as the JSON of a chart.
                <div className="min-w-0 rounded-lg bg-ui-inset px-3 py-2.5 wrap-anywhere shadow-[inset_0_0_0_1px_var(--border)]">
                    <Markdown text={fallback} fileLinks={false} />
                </div>
            )}
        </div>
    );
}
