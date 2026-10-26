import { useTranslation } from 'react-i18next';
import { Minimize2 } from 'lucide-react';
import { formatTokens } from '@adecore/ui/format';
import { Button, Icon } from '@adecore/ui';
import type { ResumeCompactionReason } from '../logic/resume-compaction';

interface ResumeCompactionDockProps {
    tokens: number;
    /* Why the next message pays for the whole thread; without it the chat only lay still. */
    reason?: ResumeCompactionReason;
    onCompact(): void;
    onDismiss(): void;
}

/*
 * The offer at the top of the composer, for a chat whose prompt cache went cold, so the next message
 * pays for the whole thread again. It takes no keys and blocks nothing: typing and sending keeps the
 * full history, which is what a person who ignores this does.
 */
export function ResumeCompactionDock({ tokens, reason = 'idle', onCompact, onDismiss }: ResumeCompactionDockProps) {
    const { t } = useTranslation('agent-chat');
    const cold = reason === 'cache-expired';

    return (
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <Icon icon={Minimize2} size={16} className="shrink-0 text-text-faint" />
            <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-sm text-text">{cold ? t('resumeCompaction.cacheExpired.title') : t('resumeCompaction.title')}</span>
                <span className="truncate text-xs tabular-nums text-text-faint">
                    {t(cold ? 'resumeCompaction.cacheExpired.carried' : 'resumeCompaction.carried', { tokens: formatTokens(tokens) })}
                </span>
            </span>
            <Button size="sm" onClick={onDismiss}>
                {t('resumeCompaction.keep')}
            </Button>
            <Button size="sm" variant="primary" onClick={onCompact}>
                {t('resumeCompaction.compact')}
            </Button>
        </div>
    );
}
