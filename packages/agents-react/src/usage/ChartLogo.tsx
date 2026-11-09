import type { UsageProvider } from '@adecore/agent-contracts';
import { ProviderLogo } from '../agents/ProviderLogo';
import { PROVIDER_COLORS } from './format';

export function ChartLogo({ provider, className }: { provider: UsageProvider; className?: string }) {
    return (
        <span className={className} style={{ color: PROVIDER_COLORS[provider] }}>
            <ProviderLogo provider={provider} />
        </span>
    );
}
