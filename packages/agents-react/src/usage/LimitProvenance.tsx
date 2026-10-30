import type { UsageLimitsProvider } from '@adecore/agent-contracts';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { checkedAge, checkedLabel } from './limit-groups';

export function LimitProvenance({ entry, now }: { entry: UsageLimitsProvider; now: number }) {
    const { t } = useTranslation('agent-usage');
    const age = checkedAge(entry, now);
    const when = checkedLabel(entry, now);
    const retained = entry.unavailable?.reason === 'failed' && entry.windows.length > 0;

    if (entry.checkedAt === 0 && entry.windows.length === 0) {
        return null;
    }

    return (
        <p className={clsx('flex flex-wrap gap-x-2 text-xs', age !== null && age >= 600_000 ? 'text-status-needs-you' : 'text-text-muted')}>
            {retained && <span>{t('limits.lastKnown')}</span>}
            <span>{when === null ? t('limits.checked.unknown') : t('limits.checked.updated', { when })}</span>
            {age !== null && age >= 600_000 && <span>{t('limits.checked.old')}</span>}
        </p>
    );
}
