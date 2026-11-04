import { describe, expect, test } from 'bun:test';
import type { ProviderInfo, ProviderPlatform } from '@adecore/agent-contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatHostProvider, type ChatHost } from '../host';
import { ChatScopeContext, type ChatScope } from '../scope';
import { installPlatforms, installStepStates, type ProviderInstallStep } from './install-steps';
import { InstallPage } from './InstallPage';

const install: NonNullable<ProviderInfo['install']> = {
    description: 'A coding agent in a terminal.',
    commands: { darwin: 'brew install acme', linux: 'curl -fsSL https://acme.test/install.sh | sh' },
    guideUrl: 'https://acme.test/install',
    signIn: [
        { kind: 'command', command: 'acme login' },
        { kind: 'env', variable: 'ACME_API_KEY' }
    ]
};

function providerOf(patch: Partial<ProviderInfo> = {}): ProviderInfo {
    return {
        kind: 'acme',
        name: 'Acme',
        installed: false,
        version: null,
        models: [],
        capabilities: { terminal: true },
        install,
        ...patch
    } as unknown as ProviderInfo;
}

const scope = { id: 'host' } as ChatScope;

function render(
    provider: ProviderInfo,
    { signedIn = false, extra = null, host = {} }: { signedIn?: boolean; extra?: ProviderInstallStep | null; host?: Partial<ChatHost> } = {}
): string {
    return renderToStaticMarkup(
        createElement(
            ChatScopeContext.Provider,
            { value: scope },
            createElement(ChatHostProvider, { host }, createElement(InstallPage, { provider, signedIn, extra }))
        )
    );
}

/* The state of each step, in order, as the page marks it. */
const statesIn = (markup: string): string[] => [...markup.matchAll(/data-state="(\w+)"/g)].map((match) => match[1]!);

const onMachine = (platform: ProviderPlatform | null): Partial<ChatHost> => ({ useMachinePlatform: () => platform });

describe('installStepStates', () => {
    test('the first step not done is the current one, and the rest wait', () => {
        expect(installStepStates([true, false, false])).toEqual(['done', 'current', 'later']);
        expect(installStepStates([false, false])).toEqual(['current', 'later']);
    });
});

describe('installPlatforms', () => {
    test('opens on the machine, or on the first system with a command when the machine has none', () => {
        expect(installPlatforms(providerOf(), 'linux')).toEqual({ offered: ['darwin', 'linux'], initial: 'linux' });
        expect(installPlatforms(providerOf(), 'win32')).toEqual({ offered: ['darwin', 'linux'], initial: 'darwin' });
    });
});

describe('InstallPage', () => {
    test('a missing CLI starts at its install, with sign-in and start still to come', () => {
        const markup = render(providerOf(), { host: onMachine('darwin') });
        expect(statesIn(markup)).toEqual(['current', 'later', 'later']);
        expect(markup).toContain('Not installed');
        expect(markup).toContain('A coding agent in a terminal.');
        expect(markup).toContain('Not found yet.');
        expect(markup).toContain('Install guide');
    });

    test('shows the command of the machine it lives on', () => {
        expect(render(providerOf(), { host: onMachine('linux') })).toContain('acme.test/install.sh');
        expect(render(providerOf(), { host: onMachine('darwin') })).toContain('brew install acme');
        expect(render(providerOf(), { host: onMachine('win32') })).toContain('brew install acme');
    });

    test('offers no Run button without a host that runs commands', () => {
        expect(render(providerOf(), { host: onMachine('darwin') })).not.toContain('Run in a terminal');
        const run = { ...onMachine('darwin'), runProviderCommand: () => undefined };
        expect(render(providerOf(), { host: run })).toContain('Run in a terminal');
    });

    test('once installed, the version is up and signing in is the current step', () => {
        const markup = render(providerOf({ installed: true, version: '1.2.3' }), { host: { runProviderCommand: () => undefined } });
        expect(statesIn(markup)).toEqual(['done', 'current', 'later']);
        expect(markup).toContain('1.2.3');
        expect(markup).not.toContain('Not installed');
        expect(markup).toContain('acme login');
        expect(markup).toContain('ACME_API_KEY');
        expect(markup).toContain('Found on this machine.');
    });

    test('names what the host does with a key only when the host says so', () => {
        const provider = providerOf({ installed: true });
        expect(render(provider)).not.toContain('never reads');
        expect(render(provider, { host: { providerKeyNote: () => 'The app never reads it.' } })).toContain('The app never reads it.');
    });

    test("the host's own step comes after the install and holds sign-in back until it is done", () => {
        const extra: ProviderInstallStep = { title: 'Install the server', done: false, body: 'Server body' };
        const markup = render(providerOf({ installed: true }), { extra });
        expect(statesIn(markup)).toEqual(['done', 'current', 'later', 'later']);
        expect(markup).toContain('Server body');
    });

    test('without install data it keeps the short note', () => {
        const markup = render(providerOf({ install: undefined }));
        expect(markup).toContain('Install Acme to use it here.');
        expect(markup).not.toContain('<ol');
    });
});
