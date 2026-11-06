import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BackendEvent, BackendLaunch } from '../backends/backend.ts';
import { fakeAcpWith, type FakeAcpOptions } from '../testing/fake-acp.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { UsageService } from '../usage/usage-service.ts';
import { ProviderAccountsService } from './accounts/service.ts';
import {
    AGENT_DEFAULT_MODEL,
    ANTIGRAVITY_MODES,
    COPILOT_MODES,
    GROK_MODES,
    adoptGrokModels,
    antigravityOneShotArgs,
    copilotUsageDirectory,
    createAntigravityProvider,
    createCopilotProvider,
    createGrokProvider,
    grokAuthMethod,
    readGrokModels,
    shippedAgentCatalog,
    type AcpServerLaunch
} from './acp-vendors.ts';
import { ModelCatalog } from './catalog.ts';
import type { ChatProvider } from './provider.ts';
import { ProviderRegistry } from './registry.ts';

const homes: string[] = [];

afterEach(async () => {
    await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })));
});

async function newHome(): Promise<string> {
    const folder = await mkdtemp(join(tmpdir(), 'acp-vendors-'));
    homes.push(folder);

    return folder;
}

const GROK_SESSION_MODES = ['default', 'plan', 'ask'];

/* A chat backend of the provider on the fake ACP agent, the events it raised and the arguments it started with. */
function run(provider: ChatProvider, options: FakeAcpOptions, overrides: Partial<BackendLaunch> = {}) {
    const events: BackendEvent[] = [];
    const methods: string[] = [];
    const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
    const done = Promise.withResolvers<void>();

    const fake = inProcess((io) => {
        const program = fakeAcpWith(options)(io);

        return {
            onLine: (line) => {
                const frame = JSON.parse(line) as { method?: string; params?: Record<string, unknown> };

                if (frame.method) {
                    methods.push(frame.method);
                    requests.push({ method: frame.method, params: frame.params ?? {} });
                }

                program.onLine(line);
            }
        };
    });

    const plain: BackendLaunch = {
        command: provider.command,
        cwd: '/tmp',
        env: {},
        selection: provider.catalog.normalize(undefined),
        modelName: provider.catalog.nameOf(provider.catalog.defaultModel),
        runtimeMode: 'supervised',
        resume: null,
        generation: 1,
        instructions: null,
        resumeNote: null,
        spawn: fake.spawn,
        ...overrides
    };

    const backend = provider.createBackend(provider.launch?.(plain) ?? plain, {
        onEvent: (event) => {
            events.push(event);

            if (event.type === 'turn.done') {
                done.resolve();
            }
        }
    });

    return { backend, events, methods, requests, fake, turnDone: done.promise };
}

const HELLO = { promptId: 'p1', text: 'hello', preamble: null, attachments: [], mentions: [], skills: [] };

function textOf(events: BackendEvent[]): string {
    return events.flatMap((event) => (event.type === 'text.done' ? [event.text] : [])).join('');
}

describe('Grok', () => {
    test('runs as an ACP agent over stdio, without an update check, and as a terminal', () => {
        const grok = createGrokProvider();

        expect(grok.kind).toBe('grok');
        expect(grok.command).toEqual(['grok', '--no-auto-update', 'agent', 'stdio']);
        expect(grok.capabilities.chat).toBe(true);
        expect(grok.capabilities.terminal).toBe(true);
        expect(grok.home).toEqual({ env: 'GROK_HOME', fallback: '.grok', loginEnv: ['XAI_API_KEY'], loginCommand: 'grok login' });
        expect(grok.firstPromptArgs('fix it')).toEqual(['fix it']);
    });

    test('only supervised names a session mode, since Grok has no mode that widens what it may do', () => {
        expect(GROK_MODES).toEqual({ supervised: ['default'] });
    });

    test('signs in with the key in the environment where there is one, else with the stored login', () => {
        expect(grokAuthMethod({ XAI_API_KEY: 'key' })).toBe('xai.api_key');
        expect(grokAuthMethod({})).toBe('cached_token');
    });

    test('a turn goes through and back, signed in with the stored login and left on its own model', async () => {
        const { backend, events, methods, fake, turnDone } = run(createGrokProvider(), { authMethod: 'cached_token', modes: GROK_SESSION_MODES });

        await backend.start();
        expect(fake.started[0]?.argv).toEqual(['--no-auto-update', 'agent', 'stdio']);
        expect(methods).toEqual(['initialize', 'session/new', 'authenticate', 'session/new']);

        backend.sendTurn(HELLO);
        await turnDone;
        expect(textOf(events)).toBe('echo: hello');
        expect(events).toContainEqual(expect.objectContaining({ type: 'turn.done', promptId: 'p1', state: 'done' }));
        expect(methods).not.toContain('session/set_model');
        await backend.dispose();
    });

    test('the models a chat reports fill the catalog, with the current one as the default', async () => {
        const provider = createGrokProvider();
        const { backend } = run(provider, { authMethod: 'cached_token', modes: GROK_SESSION_MODES });

        await backend.start();
        expect(provider.catalog.list().map((model) => model.slug)).toEqual(['fake-small', 'fake-large']);
        expect(provider.catalog.defaultModel).toBe('fake-small');
        await backend.dispose();
    });

    test('what a chat signed in with the key learns reaches the listed provider and its listeners', async () => {
        const provider = createGrokProvider();
        let changes = 0;

        provider.onChange?.(() => {
            changes += 1;
        });

        const { backend } = run(
            provider,
            { authMethod: 'xai.api_key', modes: GROK_SESSION_MODES, commands: ['compact', 'goal'] },
            { env: { XAI_API_KEY: 'key' } }
        );

        await backend.start();
        expect(provider.capabilities.compaction).toBe('prompt');
        expect(provider.capabilities.goals).toBe('command');
        expect(provider.catalog.list().map((model) => model.slug)).toEqual(['fake-small', 'fake-large']);
        expect(changes).toBeGreaterThan(0);
        await backend.dispose();
    });

    test('a full-access chat stays in the default session mode', async () => {
        const { backend, methods } = run(createGrokProvider(), { modes: GROK_SESSION_MODES }, { runtimeMode: 'full-access' });

        await backend.start();
        expect(methods).not.toContain('session/set_mode');
        await backend.dispose();
    });
});

// As Grok 1.0.62 prints `grok models`.
const GROK_MODELS = [
    'You are logged in with grok.com.',
    '',
    'Default model: grok-4.7',
    '',
    'Available models:',
    '  * grok-4.7 (default)',
    '  - grok-4.7-build-fast',
    '  - grok-4.6',
    ''
].join('\n');

describe('grok models', () => {
    test('a login on the first line is signed in, with the listed models and the default', () => {
        expect(readGrokModels(GROK_MODELS)).toEqual({ signedIn: true, defaultModel: 'grok-4.7', models: ['grok-4.7', 'grok-4.7-build-fast', 'grok-4.6'] });
        expect(readGrokModels(GROK_MODELS.replace('You are logged in with grok.com.', 'You are using XAI_API_KEY.')).signedIn).toBe(true);
    });

    test('"not authenticated" is signed out, and a first line it does not know is no answer', () => {
        expect(readGrokModels(GROK_MODELS.replace('You are logged in with grok.com.', 'You are not authenticated.')).signedIn).toBe(false);
        expect(() => readGrokModels('error: something broke\n')).toThrow('Grok did not say who is signed in');
        expect(() => readGrokModels('')).toThrow('Grok did not say who is signed in');
    });

    test('a slug that reads as a flag is left out', () => {
        expect(readGrokModels(GROK_MODELS.replace('grok-4.6', '--yolo')).models).toEqual(['grok-4.7', 'grok-4.7-build-fast']);
    });

    test('the listed models replace the catalog, with the names and reasoning effort a chat learned kept', () => {
        const effort = {
            id: 'effort',
            label: 'Reasoning',
            type: 'select' as const,
            defaultChoice: 'high',
            choices: [
                { id: 'low', label: 'Low' },
                { id: 'high', label: 'High' }
            ]
        };

        let stored: unknown = {
            commands: ['compact'],
            models: { defaultModel: 'grok-4.6', models: [{ slug: 'grok-4.6', name: 'Grok 4.6', contextWindow: 256000 }], options: [effort] }
        };

        const store = {
            load: () => stored,
            save: (value: unknown) => {
                stored = value;
            }
        };

        const catalog = new ModelCatalog({
            defaultModel: 'default',
            profiles: { agent: { options: [], contextWindowTokens: {} } },
            models: [{ slug: 'default', name: 'Default', profile: 'agent' }]
        });

        expect(adoptGrokModels(catalog, store, readGrokModels(GROK_MODELS))).toBe(true);
        expect(catalog.defaultModel).toBe('grok-4.7');
        expect(catalog.list().map((model) => [model.slug, model.name])).toEqual([
            ['grok-4.7', 'grok-4.7'],
            ['grok-4.7-build-fast', 'grok-4.7-build-fast'],
            ['grok-4.6', 'Grok 4.6']
        ]);
        expect(catalog.list()[0]?.options).toEqual([effort]);
        expect(stored).toEqual({
            commands: ['compact'],
            models: {
                defaultModel: 'grok-4.7',
                models: [
                    { slug: 'grok-4.7', name: 'grok-4.7' },
                    { slug: 'grok-4.7-build-fast', name: 'grok-4.7-build-fast' },
                    { slug: 'grok-4.6', name: 'Grok 4.6', contextWindow: 256000 }
                ],
                options: [effort]
            }
        });
        expect(adoptGrokModels(catalog, store, readGrokModels(GROK_MODELS))).toBe(false);
    });
});

describe('Copilot', () => {
    test('runs its ACP server over stdio beside its terminal', () => {
        const copilot = createCopilotProvider();

        expect(copilot.command).toEqual(['copilot', '--acp', '--stdio', '--no-auto-update']);
        expect(copilot.capabilities.chat).toBe(true);
        expect(copilot.capabilities.terminal).toBe(true);
        expect(copilot.firstPromptArgs('go')).toEqual(['-i', 'go']);
        expect(copilot.catalog.defaultModel).toBe(AGENT_DEFAULT_MODEL);
    });

    test('a supervised chat switches to the agent mode', async () => {
        const agentMode = COPILOT_MODES.supervised?.[0] ?? '';
        const { backend, methods } = run(createCopilotProvider(), { modes: ['https://agentclientprotocol.com/protocol/session-modes#autopilot', agentMode] });

        await backend.start();
        expect(methods).toContain('session/set_mode');
        await backend.dispose();
    });

    test("a turn's usage is logged in the host's folder and shows on the usage page under Copilot", async () => {
        const home = await newHome();
        setSystemTime(Date.UTC(2026, 9, 1, 12));

        try {
            const copilot = createCopilotProvider({ usageLog: copilotUsageDirectory(home) });
            const turnUsage = { totalTokens: 1500, inputTokens: 1100, outputTokens: 400, cachedReadTokens: 1000 };
            const { backend, turnDone } = run(copilot, { turnUsage });

            await backend.start();
            backend.sendTurn(HELLO);
            await turnDone;
            await backend.dispose();

            const usage = new UsageService({
                home,
                allowPriceFetch: false,
                knownProjects: async () => [],
                roots: () => [{ provider: 'copilot', path: copilotUsageDirectory(home) }]
            });

            const summary = await usage.summary({ from: '2026-10-01', to: '2026-10-01', resolution: 'day', timeZone: 'UTC' });
            usage.stop();
            expect(summary.models).toEqual([expect.objectContaining({ provider: 'copilot' })]);
            expect(summary.models[0]?.totals).toMatchObject({ calls: 1, input: 100, cacheRead: 1000, output: 400 });
        } finally {
            setSystemTime();
        }
    });
});

describe('a catalog store', () => {
    test('keeps what a chat reported, so a provider made after a restart offers it before any chat', async () => {
        let stored: unknown = null;

        const store = {
            load: () => stored,
            save: (value: unknown) => {
                stored = value;
            }
        };

        const { backend } = run(createCopilotProvider({ catalogStore: store }), { modes: [], commands: ['compact'] });

        await backend.start();
        await backend.dispose();

        const again = createCopilotProvider({ catalogStore: store });

        expect(again.catalog.list().map((model) => model.slug)).toEqual(['fake-small', 'fake-large']);
        expect(again.catalog.defaultModel).toBe('fake-small');
        expect(again.capabilities.compaction).toBe('prompt');
    });

    test('a provider without one starts from the shipped models, with the agent left its own choice', () => {
        const catalog = createCopilotProvider().catalog;

        expect(catalog.defaultModel).toBe(AGENT_DEFAULT_MODEL);
        expect(catalog.list().map((model) => model.slug)).toEqual(
            shippedAgentCatalog('copilot')
                .list()
                .map((model) => model.slug)
        );
        expect(catalog.list().length).toBeGreaterThan(1);
    });
});

describe('Antigravity', () => {
    const SERVER_MODES = ['default', 'auto_edit', 'yolo'];
    const installed: AcpServerLaunch = { launch: () => ['/home/agent-servers/antigravity/1.4.1/agy_acp_server.par', '--uid='] };
    const missing: AcpServerLaunch = { launch: () => null };

    test('chats on the installed server, keeps its accounts apart in GEMINI_HOME and runs `agy` as a terminal', () => {
        const provider = createAntigravityProvider({ server: installed });

        expect(provider.kind).toBe('antigravity');
        expect(provider.command).toEqual(['/home/agent-servers/antigravity/1.4.1/agy_acp_server.par', '--uid=']);
        expect([provider.capabilities.chat, provider.capabilities.terminal, provider.capabilities.hooks]).toEqual([true, true, true]);
        expect(provider.home).toMatchObject({ env: 'GEMINI_HOME', fallback: '.gemini', loginEnv: [] });
        expect(provider.home?.loginCommand).toBeUndefined();
        expect(provider.firstPromptArgs('go')).toEqual(['-i', 'go']);
        expect(provider.resumeCommand).toBe('agy {flags} --conversation {id}');
        expect(antigravityOneShotArgs('hi')).toEqual(['-p', 'hi', '--output-format', 'text']);
    });

    test('without an installed server it offers no chat and starts none, but stays a terminal', () => {
        const provider = createAntigravityProvider({ server: missing });

        expect([provider.capabilities.chat, provider.capabilities.terminal]).toEqual([false, true]);
        expect(createAntigravityProvider().capabilities.chat).toBe(true);
        expect(() => provider.createBackend({} as BackendLaunch, { onEvent: () => undefined })).toThrow('Install the Antigravity server');
    });

    test('offers a second account, signed in from its chat, in a GEMINI_HOME of its own', async () => {
        const home = await newHome();

        const accounts = new ProviderAccountsService({
            home,
            providers: new ProviderRegistry({
                providers: [createGrokProvider(), createAntigravityProvider({ server: installed })],
                detect: async () => ({ installed: true, version: null })
            }),
            env: { HOME: home },
            secrets: null,
            folderExists: () => true
        });

        await accounts.load();
        expect(accounts.snapshot()).toMatchObject({ loginCommands: { grok: 'grok login' }, chatLogins: ['antigravity'] });

        const created = await accounts.create({ kind: 'antigravity', label: 'Work' });
        const folder = join(home, 'accounts', created.id);

        expect(created.accounts[created.id]).toEqual({ kind: 'antigravity', label: 'Work', home: folder });
        expect(accounts.envFor('antigravity', created.id, { HOME: home }).GEMINI_HOME).toBe(folder);
    });

    test("each runtime mode names the server's own mode, the two between sharing auto_edit", () => {
        expect(ANTIGRAVITY_MODES).toEqual({ supervised: ['default'], 'auto-accept-edits': ['auto_edit'], auto: ['auto_edit'], 'full-access': ['yolo'] });
    });

    test("a turn goes through and back, signed in through the server's own browser sign-in", async () => {
        const { backend, events, methods, fake, turnDone } = run(createAntigravityProvider({ server: installed }), {
            authMethod: 'oauth-personal',
            modes: SERVER_MODES
        });

        await backend.start();
        expect(fake.started[0]?.argv).toEqual(['--uid=']);
        expect(methods).toEqual(['initialize', 'session/new', 'authenticate', 'session/new']);

        backend.sendTurn(HELLO);
        await turnDone;
        expect(textOf(events)).toBe('echo: hello');
        await backend.dispose();
    });

    test('a full-access chat switches the server to yolo, and an auto chat to auto_edit', async () => {
        for (const [runtimeMode, mode] of [
            ['full-access', 'yolo'],
            ['auto', 'auto_edit']
        ] as const) {
            const { backend, events } = run(createAntigravityProvider({ server: installed }), { modes: SERVER_MODES }, { runtimeMode });

            await backend.start();
            expect(events).toContainEqual(expect.objectContaining({ type: 'permissions', permissionMode: mode, effectiveRuntimeMode: runtimeMode }));
            await backend.dispose();
        }
    });
});

describe("the host's seams", () => {
    const HOST_ENV = { HOST_MCP_URL: 'http://127.0.0.1:4000/mcp', HOST_TOKEN: 'chat-token' };
    const HOST_SERVER = { type: 'http', name: 'host', url: 'http://127.0.0.1:4000/mcp', headers: [{ name: 'Authorization', value: 'Bearer chat-token' }] };
    const installed: AcpServerLaunch = { launch: () => ['agy_acp_server.par'] };

    // Adds the host's MCP server to a launch whose environment names it, as a host's `launch` would.
    const withHostServer = (launch: BackendLaunch): BackendLaunch => {
        const url = launch.env.HOST_MCP_URL;
        const token = launch.env.HOST_TOKEN;

        if (url === undefined || token === undefined) {
            return launch;
        }

        const server = { name: 'host', url, headers: { Authorization: `Bearer ${token}` }, allowTools: true };

        return { ...launch, mcpServers: [...(launch.mcpServers ?? []), server] };
    };

    const chats: Array<[string, () => ChatProvider]> = [
        ['Grok', () => createGrokProvider({ launch: withHostServer })],
        ['Copilot', () => createCopilotProvider({ launch: withHostServer })],
        ['Antigravity', () => createAntigravityProvider({ server: installed, launch: withHostServer })]
    ];

    for (const [name, provider] of chats) {
        test(`the launch reaches ${name}'s session request, and the server's tools run without a card`, async () => {
            const { backend, events, requests, turnDone } = run(provider(), { mcp: { http: true } }, { env: HOST_ENV });

            await backend.start();
            expect(requests.find((request) => request.method === 'session/new')?.params.mcpServers).toEqual([HOST_SERVER]);

            backend.sendTurn({ ...HELLO, text: 'mcp: host node_new' });
            await turnDone;
            expect(events.some((event) => event.type === 'approval.requested')).toBe(false);
            await backend.dispose();
        });
    }

    test('a launch that adds nothing starts without a server, and an agent that takes no HTTP server warns', async () => {
        const untold = run(createGrokProvider({ launch: withHostServer }), { mcp: { http: true } });

        await untold.backend.start();
        expect(untold.requests.find((request) => request.method === 'session/new')?.params.mcpServers).toEqual([]);
        await untold.backend.dispose();

        const unable = run(createGrokProvider({ launch: withHostServer }), {}, { env: HOST_ENV });

        await unable.backend.start();
        expect(unable.requests.find((request) => request.method === 'session/new')?.params.mcpServers).toEqual([]);
        expect(unable.events).toContainEqual({ type: 'note', level: 'warning', text: 'Grok takes no MCP servers over HTTP, so it runs without host.' });
        await unable.backend.dispose();
    });

    test('the client info names the host to the agent in initialize', async () => {
        const client = { name: 'host', title: 'Host', version: '1.2.3' };
        const { backend, requests } = run(createCopilotProvider({ client }), {});

        await backend.start();
        expect(requests.find((request) => request.method === 'initialize')?.params.clientInfo).toEqual(client);
        await backend.dispose();
    });
});
