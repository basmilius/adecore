import { describe, expect, test } from 'bun:test';
import type { BackendLaunch } from '../backends/backend.ts';
import { DEFAULT_CODEX_CLIENT } from '../backends/codex-transport.ts';
import { codexServiceTier, codexThreadOptions } from '../backends/codex.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { fakeCodex } from '../testing/fake-codex.ts';
import { createCodexProvider } from './codex-provider.ts';
import type { ChatProvider } from './provider.ts';
import { ProviderRegistry } from './registry.ts';

describe('codex catalog', () => {
    test('lists the app-server models with a reasoning option and one default', () => {
        const registry = new ProviderRegistry({ detect: async () => ({ installed: true, version: '0.153.4' }) });
        const codex = registry.catalogFor('codex');
        const models = codex.list();
        expect(models.filter((model) => model.isDefault).map((model) => model.slug)).toEqual(['gpt-6.2-astra']);
        expect(models.find((model) => model.slug === 'gpt-5.6-sol')?.options[0]).toMatchObject({ id: 'effort', type: 'select', defaultChoice: 'low' });

        for (const [alias, slug] of [
            ['gpt-6', 'gpt-6-astra'],
            ['luna', 'gpt-6-luna']
        ]) {
            expect(codex.normalize({ model: alias })).toEqual({
                model: slug,
                options: { effort: 'medium', serviceTier: false }
            });
            expect(codex.normalize({ model: slug, options: { effort: 'max' } }).options.effort).toBe('max');
        }

        expect(codex.normalize({ model: 'terra' })).toEqual({ model: 'gpt-6.1-terra', options: { effort: 'low', serviceTier: false } });
        expect(codex.normalize({ model: 'sol' })).toEqual({ model: 'gpt-6.2-sol', options: { effort: 'low', serviceTier: false } });
        expect(models.find((model) => model.slug === 'gpt-5.6-terra')).toMatchObject({ legacy: true, badge: 'retiring' });
        expect(codex.normalize({ model: 'gpt-5.6-terra', options: { effort: 'high' } }).model).toBe('gpt-5.6-terra');
        expect(codex.normalize({ model: 'astra', options: { effort: 'ultra', contextWindow: '1m' } })).toEqual({
            model: 'gpt-6.2-astra',
            options: { effort: 'ultra', serviceTier: false }
        });
        expect(codex.normalize({ model: 'gpt-5.5', options: { effort: 'ultra' } }).options.effort).toBe('medium');
        expect(codex.contextWindowFor(codex.normalize({ model: 'spark' }))).toBe(121600);
        expect(registry.catalogFor('claude')).not.toBe(codex);
    });
});

describe('codexServiceTier', () => {
    test('is the priority tier when the option is on, and nothing when it is off', () => {
        expect(codexServiceTier({ model: 'gpt-6-astra', options: { serviceTier: true } })).toBe('priority');
        expect(codexServiceTier({ model: 'gpt-6-astra', options: { serviceTier: false } })).toBeNull();
        expect(codexServiceTier({ model: 'gpt-5.3-codex-spark', options: {} })).toBeNull();
    });

    test('the models the app-server gives a tier carry the option; spark does not', () => {
        const codex = new ProviderRegistry({ detect: async () => ({ installed: true, version: '0.153.4' }) }).catalogFor('codex');

        const options = (slug: string) => codex.list().find((model) => model.slug === slug)?.options ?? [];

        expect(options('gpt-6-astra').find((option) => option.id === 'serviceTier')).toMatchObject({ type: 'boolean', defaultValue: false });
        expect(options('gpt-5.3-codex-spark').some((option) => option.id === 'serviceTier')).toBe(false);
    });
});

describe('a server marked direct, by the version the registry read', () => {
    const SERVER = { name: 'own', url: 'http://127.0.0.1:4000/mcp', tokenVariable: 'OWN_TOKEN', directTools: true };
    const OMIT = 'mcp_servers.own.omit_tools_from=["code_mode","deferred"]';

    async function providerAt(version: string | null): Promise<ChatProvider> {
        const provider = createCodexProvider({
            client: DEFAULT_CODEX_CLIENT,
            help: async () => '',
            detect: async () => ({ installed: version !== null, version })
        });
        await new ProviderRegistry({ providers: [provider], env: {} }).list();

        return provider;
    }

    async function chatCommand(provider: ChatProvider): Promise<string[]> {
        const fake = inProcess(fakeCodex);
        let command: string[] = [];

        const launch: BackendLaunch = {
            command: ['codex'],
            cwd: '/tmp',
            env: {},
            selection: provider.catalog.normalize(undefined),
            modelName: 'Codex',
            runtimeMode: 'supervised',
            resume: null,
            generation: 1,
            instructions: null,
            resumeNote: null,
            mcpServers: [{ ...SERVER, allowTools: true }],
            spawn: (options) => {
                command = options.command;

                return fake.spawn(options);
            }
        };

        const backend = provider.createBackend(launch, { onEvent: () => undefined });
        await backend.start();
        await backend.dispose();

        return command;
    }

    test('a chat on Codex 0.166.0 keeps its tools out of Code Mode, and one on an older or unknown Codex leaves the key out', async () => {
        expect(await chatCommand(await providerAt('0.166.0'))).toContain(OMIT);
        expect((await chatCommand(await providerAt('0.165.2'))).join(' ')).not.toContain('omit_tools_from');
        expect((await chatCommand(await providerAt(null))).join(' ')).not.toContain('omit_tools_from');
    });

    test('a terminal on Codex 0.166.0 keeps its tools out of Code Mode, and one on an older or unknown Codex leaves the key out', async () => {
        expect((await providerAt('0.166.0')).terminal!.mcpArgs!(SERVER)).toContain(OMIT);
        expect((await providerAt('0.165.2')).terminal!.mcpArgs!(SERVER).join(' ')).not.toContain('omit_tools_from');
        expect((await providerAt(null)).terminal!.mcpArgs!(SERVER).join(' ')).not.toContain('omit_tools_from');
    });
});

describe('codexThreadOptions', () => {
    test('maps the runtime modes to an approval policy and a sandbox', () => {
        expect(codexThreadOptions('supervised')).toEqual({ approvalPolicy: 'untrusted', sandbox: 'read-only' });
        expect(codexThreadOptions('auto-accept-edits')).toEqual({ approvalPolicy: 'untrusted', sandbox: 'workspace-write' });
        expect(codexThreadOptions('auto')).toEqual({ approvalPolicy: 'on-request', sandbox: 'workspace-write' });
        expect(codexThreadOptions('full-access')).toEqual({ approvalPolicy: 'never', sandbox: 'danger-full-access' });
    });

    test('full access on Codex 0.166.0 asks only for MCP elicitations, and the modes that ask stay as they are', () => {
        expect(codexThreadOptions('full-access', '0.166.0')).toEqual({
            approvalPolicy: { granular: { mcp_elicitations: true, rules: false, sandbox_approval: false, skill_approval: false, request_permissions: false } },
            sandbox: 'danger-full-access'
        });
        expect(codexThreadOptions('auto', '0.166.0')).toEqual({ approvalPolicy: 'on-request', sandbox: 'workspace-write' });
        expect(codexThreadOptions('full-access', '0.166.0-alpha.1')).toEqual({ approvalPolicy: 'never', sandbox: 'danger-full-access' });
    });
});
