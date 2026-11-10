import type { ProviderCapabilities } from '@adecore/agent-contracts';

/* Whether a message sent while a turn runs may join it. Undefined while the host has not answered `provider.list`, which steers nothing. */
export function canSteer(capabilities: ProviderCapabilities | undefined): boolean {
    return capabilities?.steer === true;
}
