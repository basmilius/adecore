import type { Ref } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Button, Pill, Switch, Tooltip } from '@adecore/ui';

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

/* Auto-commit on or off, and while a transaction is open, the way to end it. */
export function TransactionControls({ mode, onModeChange, open, busy, onCommit, onRollback, className, ref }: TransactionControlsProps) {
    const { t } = useTranslation('database');
    return (
        <div ref={ref} className={clsx('flex items-center gap-2', className)}>
            <Tooltip label={t('console.transaction.hint')}>
                <div className="flex items-center gap-2 text-xs text-text">
                    <Switch
                        checked={mode === 'auto'}
                        label={t('console.transaction.autoCommit')}
                        disabled={busy}
                        onCheckedChange={(auto) => onModeChange(auto ? 'auto' : 'manual')}
                    />
                    <span>{t('console.transaction.autoCommit')}</span>
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
