import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { AgentKind, ModelInfo, ProviderInfo } from '@adecore/agent-contracts';
import { ModelOptionControl } from '../agents/ModelOptionControl';
import { carryOptions } from '../agents/model-options';
import { optionWord } from '../agents/option-words';
import { AccountDot } from '../agents/AccountDot';
import { accountName, offeredAccounts, type AccountEntry, type AccountLogin } from '../agents/accounts';
import { accountFor, forgetChatSelection, rememberChatAccount, rememberChatSelection, selectionFor, useChatPreferences } from '../chat/preferences';
import { knownAccounts, useProviderAccounts } from '../state/provider-accounts';
import { useChatHost } from '../host';
import { useHostCanReorderAccounts } from '../host-hooks';
import { useChatScope } from '../scope';
import { reorderAccounts } from './account-actions';
import { AccountOrderList } from './AccountOrderList';
import { providerAbilities } from './provider-abilities';
import { DetailHeader, SettingsRow, SettingsSection } from '@adecore/ui/settings';
import { Button, Icon, Select } from '@adecore/ui';
import { CliTile } from './parts';

const PROVIDER_DEFAULT = '';

/* One row per knob the chosen model exposes; the composer's option picker shows the same descriptors. */
function ModelOptionRows({ provider, model, options }: { provider: AgentKind; model: ModelInfo; options: Record<string, string | boolean> }) {
    const setOption = (id: string, value: string | boolean): void => {
        rememberChatSelection(provider, { model: model.slug, options: { ...options, [id]: value } });
    };

    return (
        <>
            {model.options.map((option) => (
                <SettingsRow
                    key={option.id}
                    indent
                    muted
                    label={optionWord(option)}
                    control={<ModelOptionControl option={option} options={options} layout="row" onChange={(value) => setOption(option.id, value)} />}
                />
            ))}
        </>
    );
}

interface CliDetailProps {
    provider: ProviderInfo;
    /* Null for a machine that keeps no accounts. */
    entries: AccountEntry[] | null;
    defaults: boolean;
    login: AccountLogin;
    onAddAccount(): void;
    onPickAccount(id: string): void;
}

/* One CLI: what it is, what a new chat of it starts with unless `defaults` is off, and its accounts. */
export function CliDetail({ provider, entries, defaults, login, onAddAccount, onPickAccount }: CliDetailProps) {
    const { t } = useTranslation('agent-providers');
    const scope = useChatScope();
    const host = useChatHost();
    const canReorder = useHostCanReorderAccounts(scope.id);
    const preferences = useChatPreferences();
    const selection = selectionFor(preferences, provider.kind);
    const model = provider.models.find((entry) => entry.slug === selection?.model);
    const canAddAccount = login !== null;
    const ordered = canReorder && entries !== null && entries.length >= 2;
    // A machine that keeps no order of its accounts starts a new chat on the account picked here.
    const machineAccounts = useProviderAccounts(knownAccounts);
    const picked = accountFor(preferences, scope.id, provider.kind, machineAccounts) ?? provider.kind;
    const choosable = canReorder ? [] : offeredAccounts(entries ?? [], picked);

    return (
        <>
            <DetailHeader
                mark={<CliTile kind={provider.kind} />}
                title={provider.name}
                subtitle={`${provider.version ? `${t('abilities.version', { version: provider.version })} ` : ''}${providerAbilities(provider)}`}
                actions={
                    canAddAccount && (
                        <Button variant="secondary" className="whitespace-nowrap" onClick={onAddAccount}>
                            <Icon icon={Plus} size={14} />
                            {t('cli.addAccount')}
                        </Button>
                    )
                }
            />
            {defaults && (
                <SettingsSection
                    title={t('cli.defaults.title')}
                    description={t(canReorder ? 'cli.defaults.description' : 'cli.defaults.descriptionWithAccount')}
                >
                    {choosable.length > 0 && (
                        <SettingsRow
                            searchId="providers.defaults.account"
                            label={t('cli.defaults.account')}
                            control={
                                <Select
                                    value={picked}
                                    label={t('cli.defaults.accountFor', { provider: provider.name })}
                                    align="end"
                                    items={choosable.map((entry) => ({
                                        value: entry.id,
                                        label: accountName(entry, provider.name),
                                        icon: <AccountDot color={entry.account.color} className="size-2" />
                                    }))}
                                    onValueChange={(id) => rememberChatAccount(scope.id, provider.kind, id)}
                                />
                            }
                        />
                    )}
                    {provider.models.length > 0 && (
                        <SettingsRow
                            searchId="providers.defaults.model"
                            label={t('cli.defaults.model')}
                            description={model ? t('cli.defaults.shared', { provider: provider.name }) : t('cli.defaults.usesCliDefault')}
                            control={
                                <Select
                                    value={model?.slug ?? PROVIDER_DEFAULT}
                                    label={t('cli.defaults.modelFor', { provider: provider.name })}
                                    align="end"
                                    items={[
                                        { value: PROVIDER_DEFAULT, label: t('cli.defaults.providerDefault') },
                                        ...provider.models.map((entry) => ({
                                            value: entry.slug,
                                            label: entry.legacy ? t('cli.defaults.legacyModel', { name: entry.name }) : entry.name
                                        }))
                                    ]}
                                    onValueChange={(value) =>
                                        value === PROVIDER_DEFAULT
                                            ? forgetChatSelection(provider.kind)
                                            : rememberChatSelection(provider.kind, {
                                                  model: value,
                                                  options: carryOptions(
                                                      selection?.options ?? {},
                                                      provider.models.find((entry) => entry.slug === value)
                                                  )
                                              })
                                    }
                                />
                            }
                        />
                    )}
                    {model && <ModelOptionRows provider={provider.kind} model={model} options={selection?.options ?? {}} />}
                    {choosable.length === 0 && provider.models.length === 0 && <SettingsRow muted label={t('cli.defaults.usesCliDefault')} />}
                </SettingsSection>
            )}
            {entries === null ? (
                <p className="text-xs text-text-faint">{t('list.noAccounts')}</p>
            ) : (
                <SettingsSection
                    title={t('cli.accounts')}
                    description={ordered ? t('cli.accountsOrder') : undefined}
                    footer={canAddAccount ? undefined : t('cli.onlyDefault', { provider: provider.name })}
                >
                    <AccountOrderList
                        entries={entries}
                        providerName={provider.name}
                        login={login}
                        onReorder={ordered ? (ids) => void reorderAccounts(scope, host, provider.kind, ids) : null}
                        onPickAccount={onPickAccount}
                    />
                </SettingsSection>
            )}
        </>
    );
}
