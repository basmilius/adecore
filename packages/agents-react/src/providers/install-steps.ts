import type { ReactNode } from 'react';
import type { ProviderInfo, ProviderPlatform } from '@adecore/agent-contracts';
import { isApplePlatform } from '@adecore/ui';

/* A step of the host's own on a provider's install page, such as a server its chat needs beside the CLI. */
export interface ProviderInstallStep {
    title: string;
    done: boolean;
    /* Drawn under the title; the page numbers the step and outlines it while it is the current one. */
    body: ReactNode;
}

export type InstallStepState = 'done' | 'current' | 'later';

const PLATFORMS: readonly ProviderPlatform[] = ['darwin', 'linux', 'win32'];

/* The first step not done is the current one. */
export function installStepStates(done: readonly boolean[]): InstallStepState[] {
    const first = done.indexOf(false);

    return done.map((value, index) => (value ? 'done' : index === first ? 'current' : 'later'));
}

/* The system of the page, for a host that does not say which system its machine runs. */
export function pagePlatform(): ProviderPlatform {
    if (isApplePlatform()) {
        return 'darwin';
    }

    return typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent) ? 'win32' : 'linux';
}

/* The systems a provider has a command for, and the one the page opens on: the machine's when it has one there. */
export function installPlatforms(provider: ProviderInfo, machine: ProviderPlatform): { offered: ProviderPlatform[]; initial: ProviderPlatform | null } {
    const offered = PLATFORMS.filter((platform) => Boolean(provider.install?.commands[platform]));

    return { offered, initial: offered.includes(machine) ? machine : (offered[0] ?? null) };
}
