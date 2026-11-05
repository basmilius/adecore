import { Segmented, Button, Icon } from '@adecore/ui';
import { SettingsRow, SettingsSection } from '@adecore/ui/settings';
import { ChartNoAxesColumn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUsage, useUsageStore, type UsageCurrency } from '../state/usage';
import { formatRateDate } from './format';

const CURRENCIES: readonly UsageCurrency[] = ['USD', 'EUR'];

/*
 * Every price a model has is in dollars, so the only choice here is what to read them in. The usage
 * page is a dialog of its own, so `onOpenPage` is where the app lets settings step aside for it.
 */
export function UsagePane({ onOpenPage }: { onOpenPage(): void }) {
    const { t } = useTranslation('agent-usage');
    const currency = useUsage((s) => s.currency);
    // The summary on screen, or the rate the last one brought: the page may not have been opened since this window started.
    const rate = useUsage((s) => s.summary?.rate ?? s.rate);

    return (
        <SettingsSection>
            <SettingsRow
                searchId="usage.currency"
                label={t('settings.currency.label')}
                description={
                    currency === 'USD'
                        ? t('settings.currency.dollars')
                        : rate === null
                          ? t('settings.currency.noRate')
                          : t('settings.currency.converted', { date: formatRateDate(rate.date) })
                }
                control={
                    <Segmented
                        value={currency}
                        options={CURRENCIES.map((id) => ({ id, label: t(`settings.currency.options.${id}`) }))}
                        onValueChange={(id) => useUsageStore.getState().setCurrency(id)}
                        label={t('settings.currency.label')}
                    />
                }
            />
            <SettingsRow
                searchId="usage.page"
                label={t('settings.page.label')}
                description={t('settings.page.description')}
                control={
                    <Button variant="secondary" onClick={onOpenPage}>
                        <Icon icon={ChartNoAxesColumn} size={14} /> {t('settings.page.open')}
                    </Button>
                }
            />
        </SettingsSection>
    );
}
