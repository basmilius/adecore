import type { AgentKind, ProviderInfo } from '@adecore/agent-contracts';

// `install` is a CLI picked while it was missing: its install page stays until it is installed and signed in. `catalog` is the host's page to add a provider from.
export type Picked =
    | { kind: 'cli'; cli: AgentKind }
    | { kind: 'install'; cli: AgentKind }
    | { kind: 'account'; id: string }
    | { kind: 'add'; cli: AgentKind }
    | { kind: 'catalog' };

const INSTALL_TARGET = 'providers.install.';
const ADD_TARGET = 'providers.add';

/* What a target opens on its own, before any CLI is picked; null for a target that only lands on a row of the CLI already shown. */
export function pickOfTarget(target: string | null, providers: ProviderInfo[]): Picked | null {
    if (target === 'providers.apple') {
        return { kind: 'cli', cli: 'apple' };
    }

    if (target === ADD_TARGET) {
        return { kind: 'catalog' };
    }

    if (!target?.startsWith(INSTALL_TARGET) || target.length === INSTALL_TARGET.length) {
        return null;
    }

    return pickOfCli(target.slice(INSTALL_TARGET.length) as AgentKind, providers);
}

/*
 * A CLI opened by name, from a target or from the host's page that just added it: its detail once it is there, its
 * install page while it is missing. A CLI the host has not reported yet is taken as missing, so the pick holds until
 * the next list names it; once it is installed and signed in, its install page gives way to its detail.
 */
export function pickOfCli(cli: AgentKind, providers: ProviderInfo[]): Picked {
    const provider = providers.find((entry) => entry.kind === cli);

    if (provider !== undefined && (provider.installed || !provider.capabilities.terminal)) {
        return { kind: 'cli', cli };
    }

    return { kind: 'install', cli };
}
