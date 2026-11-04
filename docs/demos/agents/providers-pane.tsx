import type { ProviderInfo } from '@adecore/agent-contracts';
import { ProvidersPane } from '@adecore/agents-react/providers';
import { MISSING_PROVIDER, PROVIDERS } from '../shared/agents-data.ts';
import { AgentDemo } from '../shared/agents.tsx';

/* A model the host runs itself and a person turns on in its detail, so it waits under "Needs setup". */
const LOCAL_PROVIDER: ProviderInfo = {
    ...MISSING_PROVIDER,
    kind: 'local',
    name: 'Local model',
    installed: false,
    install: undefined,
    capabilities: { ...MISSING_PROVIDER.capabilities, terminal: false }
};

export default function ProvidersPaneDemo() {
    return (
        <AgentDemo providers={[...PROVIDERS, LOCAL_PROVIDER, MISSING_PROVIDER]}>
            <div className="flex h-[640px] w-full overflow-hidden rounded-lg border border-border bg-surface">
                <ProvidersPane setupStatusOf={(provider) => (provider.kind === 'local' ? { text: 'Off', tone: 'muted' } : null)} />
            </div>
        </AgentDemo>
    );
}
