import { useEffect } from 'react';
import type { UsageLimitsSnapshot } from '@adecore/agent-contracts';
import { useChatScope, type ChatScope } from '../scope';
import { useProviderAccounts } from '../state/provider-accounts';
import { useUsage, useUsageStore } from '../state/usage';
import { whenOpen } from '../transport';
import { limitGroups, type LimitGroup } from './limit-groups';

interface Hold {
    /* How many things on screen show this host's plan windows; at zero it lets go. */
    readers: number;
    release(): void;
}

/* Asking the CLIs is expensive, so everything that shows the windows shares one read per host. */
const holds = new Map<string, Hold>();

/* On the scope's transport as it stands: reading the windows never makes the host connect, so they fill once it is connected for another reason. */
function hold(scope: ChatScope): Hold {
    const link = scope.transport;
    const scopeId = scope.id;

    const offStatus = whenOpen(link, () => {
        link.request('usage.limits', {})
            .then((snapshot) => useUsageStore.getState().setLimits(scopeId, snapshot))
            .catch(() => undefined);
    });

    // A running turn reports its own numbers, which is what keeps a bar moving between reads.
    const offChanged = link.on('usage.limitsChanged', (snapshot) => useUsageStore.getState().setLimits(scopeId, snapshot));

    return {
        readers: 0,
        release: () => {
            offChanged();
            offStatus();
        }
    };
}

/* The snapshot of the host in scope, kept fresh for as long as anything shows it. */
export function useUsageLimits(): UsageLimitsSnapshot | null {
    const limits = useUsage((s) => s.limits);
    const scope = useChatScope();

    useEffect(() => {
        const held = holds.get(scope.id) ?? hold(scope);
        held.readers += 1;
        holds.set(scope.id, held);

        return () => {
            held.readers -= 1;

            if (held.readers === 0) {
                held.release();
                holds.delete(scope.id);
            }
        };
    }, [scope]);

    return limits;
}

/* The snapshot per CLI and account, with the accounts of the same host it is read from. */
export function useLimitGroups(limits: UsageLimitsSnapshot | null): LimitGroup[] {
    const accounts = useProviderAccounts((row) => row.accounts);

    return limits === null ? [] : limitGroups(limits, accounts);
}
