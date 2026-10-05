import type { Ref } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Button, Pill, Segmented, Tooltip } from '@adecore/ui';

export type TransactionMode = 'auto' | 'manual';

export interface TransactionControlsProps {
    mode: TransactionMode;
    onModeChange(mode: TransactionMode): void;
    /* Whether a transaction is open on the session, whichever mode began it. */
    open: boolean;
    /* The console is running a statement or settling a transaction. */
    busy: boolean;
    onCommit(): void;
    onRollback(): void;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* Auto or manual commits, and while a transaction is open, the way to end it. */
export function TransactionControls({ mode, onModeChange, open, busy, onCommit, onRollback, className, ref }: TransactionControlsProps) {
    const { t } = useTranslation('database');
    return (
        <div ref={ref} className={clsx('flex items-center gap-2', className)}>
            <Tooltip label={t('console.transaction.hint')}>
                <div className="flex">
                    <Segmented
                        value={mode}
                        onValueChange={onModeChange}
                        disabled={busy}
                        label={t('console.transaction.mode')}
                        options={[
                            { id: 'auto', label: t('console.transaction.auto') },
                            { id: 'manual', label: t('console.transaction.manual') }
                        ]}
                    />
                </div>
            </Tooltip>
            {open && (
                <>
                    <Pill tone="needsYou">{t('console.transaction.open')}</Pill>
                    <Button size="xs" variant="secondary" disabled={busy} onClick={onCommit}>
                        {t('console.transaction.commit')}
                    </Button>
                    <Button size="xs" variant="danger-outline" disabled={busy} onClick={onRollback}>
                        {t('console.transaction.rollback')}
                    </Button>
                </>
            )}
        </div>
    );
}
