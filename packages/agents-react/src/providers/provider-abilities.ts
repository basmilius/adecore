import type { ProviderInfo } from '@adecore/agent-contracts';
import i18next from 'i18next';

export function providerAbilities(provider: ProviderInfo): string {
    const where = provider.capabilities.chat ? i18next.t('agent-providers:abilities.chatAndTerminal') : i18next.t('agent-providers:abilities.terminalOnly');
    const status = provider.capabilities.hooks ? i18next.t('agent-providers:abilities.reportsStatus') : i18next.t('agent-providers:abilities.noStatus');

    return `${where} ${status}`;
}
