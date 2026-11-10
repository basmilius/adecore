import { Button, Icon, ScrollArea, copyText } from '@adecore/ui';
import clsx from 'clsx';
import { Copy } from 'lucide-react';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { CODE_TEXT } from '../code-text.ts';
import type { DraftProblem } from '../ddl/index.ts';
import { scriptOf, type Plan } from './plan.ts';

interface SqlPreviewProps {
    plan: Plan;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

function ProblemText({ problem }: { problem: DraftProblem }) {
    const { t } = useTranslation('database');

    return <>{t(`ddl.problem.${problem.code}`, { subject: problem.subject })}</>;
}

export function SqlPreview({ plan, className, ref }: SqlPreviewProps) {
    const { t } = useTranslation('database');
    const script = scriptOf(plan.statements);

    return (
        <section
            ref={ref}
            aria-label={t('designer.sql')}
            className={clsx('relative flex min-h-0 flex-col border-t border-border-soft bg-surface-sunken', className)}
        >
            <div className="flex h-8 shrink-0 items-center justify-between pr-2 pl-3">
                <span className="text-xs font-medium text-text-faint">{t('designer.sql')}</span>
                <Button variant="ghost" size="xs" disabled={script === ''} onClick={() => copyText(script)}>
                    <Icon icon={Copy} size={12} />
                    {t('designer.copy')}
                </Button>
            </div>
            <ScrollArea axis="both" className="max-h-48 min-h-12" viewportClassName="px-3 pb-3 select-text">
                {plan.problems.length > 0 ? (
                    <ul className="flex flex-col gap-1 text-xs text-status-error">
                        {plan.problems.map((problem, i) => (
                            <li key={`${problem.code}:${problem.subject}:${i}`}>
                                <ProblemText problem={problem} />
                            </li>
                        ))}
                    </ul>
                ) : script === '' ? (
                    <p className="text-xs text-text-faint">{t('designer.noChanges')}</p>
                ) : (
                    <pre className={clsx(CODE_TEXT, 'whitespace-pre text-text')}>{script}</pre>
                )}
            </ScrollArea>
        </section>
    );
}
