import { PromptDialog, ScrollArea } from '@adecore/ui';
import { TriangleAlert } from 'lucide-react';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import type { DestructiveStatement } from './destructive.ts';

export interface DestructiveDialogProps {
    /* The statements to warn about; the dialog is open while there are any. */
    statements: readonly DestructiveStatement[];
    onConfirm(): void;
    onCancel(): void;
    ref?: Ref<HTMLDivElement>;
}

/* Lists the statements that cannot be taken back and asks before they run. */
export function DestructiveDialog({ statements, onConfirm, onCancel, ref }: DestructiveDialogProps) {
    const { t } = useTranslation('database');

    return (
        <PromptDialog
            ref={ref}
            open={statements.length > 0}
            danger
            title={t('console.destructive.title')}
            titleIcon={TriangleAlert}
            description={t('console.destructive.description', { count: statements.length })}
            confirmLabel={t('console.destructive.confirm')}
            onConfirm={onConfirm}
            onOpenChange={onCancel}
        >
            <ScrollArea render={<ul />} className="mt-3 max-h-56" viewportClassName="flex flex-col gap-2">
                {statements.map((statement, index) => (
                    <li key={`${index}:${statement.sql}`} className="flex min-w-0 flex-col gap-0.5 rounded-md bg-surface-sunken px-2.5 py-1.5">
                        <span className="text-xs text-status-error">{t(`console.destructive.${statement.kind}`)}</span>
                        <span className="truncate font-mono text-xs text-text">{statement.sql.replace(/\s+/g, ' ')}</span>
                    </li>
                ))}
            </ScrollArea>
        </PromptDialog>
    );
}
