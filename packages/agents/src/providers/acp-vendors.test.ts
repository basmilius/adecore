import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BackendEvent, BackendLaunch } from '../backends/backend.ts';
import type { SpawnChatProcess } from '../chat-process.ts';
import daemonCancelFixture from '../chat/fixtures/antigravity-1.5.15-daemon-cancel.json' with { type: 'json' };
import daemonWakeFixture from '../chat/fixtures/antigravity-1.5.15-daemon-wake.json' with { type: 'json' };
import mcpTurnFixture from '../chat/fixtures/antigravity-1.5.15-mcp-turn.json' with { type: 'json' };
import steerFixture from '../chat/fixtures/antigravity-1.5.15-steer.json' with { type: 'json' };
import { playAcpRecording, recordedAnswer, type AcpTimedFrame } from '../testing/fake-acp-capture.ts';
import { fakeAcpWith, type FakeAcpOptions } from '../testing/fake-acp.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { ManualClock } from '../testing/manual-clock.ts';
import { UsageService } from '../usage/usage-service.ts';
import { ProviderAccountsService } from './accounts/service.ts';
import {
    AGENT_DEFAULT_MODEL,
    COPILOT_MODES,
    GROK_MODES,
    adoptGrokModels,
    antigravityOneShotArgs,
    antigravityUsageDirectory,
    copilotUsageDirectory,
    createAntigravityProvider,
    createCopilotProvider,
    createGrokProvider,
    grokAuthMethod,
    readGrokModels,
    shippedAgentCatalog
} from './acp-vendors.ts';
import { ModelCatalog } from './catalog.ts';
import { cliExecutable, type ChatProvider } from './provider.ts';
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

// A JSON import widens the frames to every shape the capture holds; only a prompt response's usage is read.
const mcpTurn = mcpTurnFixture as unknown as { frames: Array<{ frame: { result?: { usage?: Record<string, number> } } }> };

function run(provider: ChatProvider, options: FakeAcpOptions, overrides: Partial<BackendLaunch> = {}) {
    const events: BackendEvent[] = [];
    const methods: string[] = [];
    const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
    const envs: Array<Record<string, string>> = [];
    const done = Promise.withResolvers<void>();

    const fake = inProcess((io) => {
        // Antigravity's handshake refuses an agy below its floor, so the fake names the release the chats were recorded on.
        const program = fakeAcpWith({ version: '1.5.15', ...options })(io);

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
        spawn: (spawnOptions) => {
            envs.push(spawnOptions.env);

            return fake.spawn(spawnOptions);
        },
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

    return { backend, events, methods, requests, envs, fake, turnDone: done.promise };
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
    const AGY_MODES = ['default', 'accept-edits', 'auto', 'plan'];
    const NO_UPDATE = { AGY_CLI_DISABLE_AUTO_UPDATE: '1' };

    // `agy --version` as an installed agy answers it, with the environment it was started in.
    const versionProbe = (version: string) => {
        const envs: Array<Record<string, string>> = [];

        const fake = inProcess((io) => {
            io.out(`agy ${version}`);

            return { onLine: () => undefined };
        });

        const spawn: SpawnChatProcess = (spawnOptions) => {
            envs.push(spawnOptions.env);

            return fake.spawn(spawnOptions);
        };

        return { spawn, envs };
    };

    test('chats on `agy acp`, keeps its accounts apart in GEMINI_HOME and runs `agy` as a terminal', () => {
        const provider = createAntigravityProvider();

        expect(provider.kind).toBe('antigravity');
        expect(provider.command).toEqual(['agy', 'acp']);
        expect(cliExecutable(provider)).toBe('agy');
        expect([provider.capabilities.chat, provider.capabilities.terminal, provider.capabilities.hooks]).toEqual([true, true, true]);
        expect(provider.home).toMatchObject({ env: 'GEMINI_HOME', fallback: '.gemini', loginEnv: [] });
        expect(provider.firstPromptArgs('go')).toEqual(['-i', 'go']);
        expect(provider.resumeCommand).toBe('agy {flags} --conversation {id}');
        expect(provider.terminal?.modeArgs?.auto).toEqual(['--mode=auto']);
        expect(antigravityOneShotArgs('hi')).toEqual(['-p', 'hi', '--output-format', 'text']);
        expect(provider.oneShotEnv).toEqual(NO_UPDATE);
    });

    test('an agy older than 1.5.15 offers no chat and starts none, and its version probe never updates it', async () => {
        const old = versionProbe('1.5.14');
        const provider = createAntigravityProvider({ spawn: old.spawn });

        expect(await provider.detect('agy', {})).toEqual({ installed: true, version: '1.5.14' });
        expect(old.envs).toEqual([NO_UPDATE]);
        expect([provider.capabilities.chat, provider.capabilities.terminal]).toEqual([false, true]);
        expect(() => provider.createBackend({} as BackendLaunch, { onEvent: () => undefined })).toThrow('Antigravity chats need agy 1.5.15 or newer');

        const updated = createAntigravityProvider({ spawn: versionProbe('1.5.15').spawn });

        await updated.detect('agy', {});
        expect(updated.capabilities.chat).toBe(true);
    });

    test('an agy that names a version below 1.5.15 in its handshake starts no chat, also when no version probe ran', async () => {
        const { backend, methods } = run(createAntigravityProvider(), { modes: AGY_MODES, version: '1.5.14' });

        await expect(backend.start()).rejects.toThrow('Antigravity 1.5.14 is too old. Antigravity chats need agy 1.5.15 or newer. Update agy in a terminal');
        expect(methods).toEqual(['initialize']);
        await backend.dispose();
    });

    test('reads its models from `agy acp`, started without an update', async () => {
        const fake = inProcess(fakeAcpWith({}));
        const envs: Array<Record<string, string>> = [];
        const provider = createAntigravityProvider();

        const spawn: SpawnChatProcess = (spawnOptions) => {
            envs.push(spawnOptions.env);

            return fake.spawn(spawnOptions);
        };

        expect(await provider.refreshModels?.(provider.command, {}, { maxAgeMs: 0, spawn })).toBe(true);
        expect(provider.catalog.list().map((model) => model.slug)).toEqual(['fake-small', 'fake-large']);
        expect(fake.started[0]?.argv).toEqual(['acp']);
        expect(envs[0]).toMatchObject(NO_UPDATE);
    });

    test('offers a second account, signed in with `agy acp --login`, in a GEMINI_HOME of its own', async () => {
        const home = await newHome();

        const accounts = new ProviderAccountsService({
            home,
            providers: new ProviderRegistry({
                providers: [createGrokProvider(), createAntigravityProvider()],
                detect: async () => ({ installed: true, version: null })
            }),
            env: { HOME: home },
            secrets: null,
            folderExists: () => true
        });

        await accounts.load();
        expect(accounts.snapshot()).toMatchObject({ loginCommands: { grok: 'grok login', antigravity: 'agy acp --login' } });
        expect(accounts.snapshot().chatLogins).toBeUndefined();

        const created = await accounts.create({ kind: 'antigravity', label: 'Work' });
        const folder = join(home, 'accounts', created.id);

        expect(created.accounts[created.id]).toEqual({ kind: 'antigravity', label: 'Work', home: folder });
        expect(accounts.envFor('antigravity', created.id, { HOME: home }).GEMINI_HOME).toBe(folder);
    });

    test("a turn goes through `agy acp` and back, signed in through agy's own browser sign-in, without an update", async () => {
        const { backend, events, methods, envs, fake, turnDone } = run(createAntigravityProvider(), {
            authMethod: 'oauth-personal',
            modes: AGY_MODES
        });

        await backend.start();
        expect(fake.started[0]?.argv).toEqual(['acp']);
        expect(envs[0]).toMatchObject(NO_UPDATE);
        expect(methods).toEqual(['initialize', 'session/new', 'authenticate', 'session/new']);

        backend.sendTurn(HELLO);
        await turnDone;
        expect(textOf(events)).toBe('echo: hello');
        await backend.dispose();
    });

    test("passes the launch's HTTP MCP server although agy advertises no MCP transport", async () => {
        const server = { name: 'host', url: 'http://127.0.0.1:4000/mcp', headers: {}, allowTools: true };
        const { backend, events, requests } = run(createAntigravityProvider(), { modes: AGY_MODES }, { mcpServers: [server] });

        await backend.start();
        expect(requests.find((request) => request.method === 'session/new')?.params.mcpServers).toEqual([
            { type: 'http', name: 'host', url: 'http://127.0.0.1:4000/mcp', headers: [] }
        ]);
        expect(events.some((event) => event.type === 'note')).toBe(false);
        await backend.dispose();
    });

    test("a turn's recorded usage lands on the usage page under Antigravity and the session's model, with no price for it", async () => {
        const home = await newHome();
        setSystemTime(Date.UTC(2026, 10, 23, 12));

        try {
            // The first prompt response of agy 1.5.15: its output already holds the thoughts (total = input + cached + output).
            const response = mcpTurn.frames.map((frame) => frame.frame.result?.usage).find((usage) => usage !== undefined);
            const { backend, events, turnDone } = run(createAntigravityProvider({ usageLog: antigravityUsageDirectory(home) }), {
                modes: AGY_MODES,
                turnUsage: response
            });

            await backend.start();
            const model = events.flatMap((event) => (event.type === 'session' ? [event.model] : []))[0];
            backend.sendTurn(HELLO);
            await turnDone;
            await backend.dispose();

            const usage = new UsageService({
                home,
                allowPriceFetch: false,
                knownProjects: async () => [],
                roots: () => [{ provider: 'antigravity', path: antigravityUsageDirectory(home) }]
            });

            const summary = await usage.summary({ from: '2026-11-23', to: '2026-11-23', resolution: 'day', timeZone: 'UTC' });
            usage.stop();
            expect(model).toBe('fake-small');
            expect(summary.models).toEqual([expect.objectContaining({ provider: 'antigravity', model, costUsd: null })]);
            expect(summary.models[0]?.totals).toMatchObject({ calls: 1, input: 13964, cacheRead: 14716, output: 310, reasoning: 214 });
        } finally {
            setSystemTime();
        }
    });

    test('each runtime mode runs in a mode agy 1.5 offers, full access in default with the backend answering', async () => {
        for (const [runtimeMode, mode] of [
            ['supervised', 'default'],
            ['auto-accept-edits', 'accept-edits'],
            ['auto', 'auto'],
            ['full-access', 'default']
        ] as const) {
            const { backend, events, turnDone } = run(createAntigravityProvider(), { modes: AGY_MODES }, { runtimeMode });

            await backend.start();
            expect(events).toContainEqual(expect.objectContaining({ type: 'session', permissionMode: mode, effectiveRuntimeMode: runtimeMode }));

            if (runtimeMode === 'full-access') {
                backend.sendTurn({ ...HELLO, text: 'mcp: elsewhere node_new' });
                await turnDone;
                expect(events.some((event) => event.type === 'approval.requested')).toBe(false);
            }

            await backend.dispose();
        }
    });
});

describe('an Antigravity chat replayed from agy 1.5.15', () => {
    type Frame = AcpTimedFrame['frame'];

    const mcpFrames = mcpTurn.frames as unknown as AcpTimedFrame[];
    const handshake = { initialize: recordedAnswer(mcpFrames, 'initialize'), 'session/new': recordedAnswer(mcpFrames, 'session/new') };
    const isPromptAnswer = (frame: Frame): boolean => frame.method === undefined && (frame.result as Frame | undefined)?.stopReason !== undefined;
    const isUsage = (frame: Frame): boolean => ((frame.params as Frame | undefined)?.update as Frame | undefined)?.sessionUpdate === 'usage_update';
    const timeOf = (frames: readonly AcpTimedFrame[], match: (frame: Frame) => boolean): number =>
        frames.find((entry) => entry.dir !== 'in' && match(entry.frame))!.t;

    // A full-access chat on the provider's own backend, against the frames of a recording on a manual clock.
    const replay = (frames: readonly AcpTimedFrame[], overrides: Partial<BackendLaunch> = {}) => {
        const provider = createAntigravityProvider();
        const clock = new ManualClock();
        const player = playAcpRecording(frames, clock, handshake);
        const fake = inProcess(player.cli);
        const events: BackendEvent[] = [];

        const launch: BackendLaunch = {
            command: provider.command,
            cwd: '/tmp/capture',
            env: {},
            selection: provider.catalog.normalize(undefined),
            modelName: provider.catalog.nameOf(provider.catalog.defaultModel),
            runtimeMode: 'full-access',
            resume: null,
            generation: 1,
            instructions: null,
            resumeNote: null,
            clock,
            spawn: fake.spawn,
            ...overrides
        };

        const backend = provider.createBackend(launch, { onEvent: (event) => events.push(event) });
        const methods = (): string[] => player.received.flatMap((frame) => (typeof frame.method === 'string' ? [frame.method] : []));

        return { provider, backend, player, events, methods };
    };

    const turn = (text: string) => ({ ...HELLO, promptId: `prompt-${text}`, text });

    test('ends a wake after a daemon command three seconds after its usage_update', async () => {
        const frames = daemonWakeFixture.frames as AcpTimedFrame[];
        const answered = timeOf(frames, isPromptAnswer);
        const wakeUsage = frames.find((entry) => isUsage(entry.frame) && entry.t > answered)!.t;
        const run = replay(frames);
        await run.backend.start();
        run.backend.sendTurn(turn('daemons'));
        await run.player.playTo(wakeUsage + 2_999);

        expect(run.events.filter((event) => event.type === 'turn.done')).toHaveLength(1);

        await run.player.playTo(wakeUsage + 3_000);

        expect(run.events.at(-1)).toEqual({ type: 'turn.done', state: 'done', costUsd: 0 });

        await run.backend.dispose();
    });

    test('keeps a daemon command as background work, and its stop sends session/cancel', async () => {
        const frames = daemonCancelFixture.frames as AcpTimedFrame[];
        const run = replay(frames);
        await run.backend.start();
        run.backend.sendTurn(turn('daemon'));
        await run.player.playTo(timeOf(frames, isPromptAnswer));

        expect(run.events).toContainEqual(expect.objectContaining({ type: 'background.started', taskId: 'call_15227589526489405582' }));

        run.backend.stopTask?.('call_15227589526489405582');
        await run.player.playTo(frames.at(-1)!.t);

        expect(run.methods().at(-1)).toBe('session/cancel');
        expect(run.events.at(-1)).toMatchObject({ type: 'background.ended', taskId: 'call_15227589526489405582' });

        await run.backend.dispose();
    });

    test("reads an mcp_ call as the tool of the launch's server", async () => {
        const run = replay(mcpFrames, { mcpServers: [{ name: 'ruimte', url: 'http://127.0.0.1:50000/mcp', allowTools: true }] });
        const starting = run.backend.start();
        await run.player.playTo(mcpFrames.find((entry) => entry.frame.method === 'session/prompt')!.t);
        await starting;
        run.backend.sendTurn(turn('tools'));
        await run.player.playTo(timeOf(mcpFrames, isPromptAnswer));

        expect(run.events.find((event) => event.type === 'tool.started')).toMatchObject({ name: 'mcp__ruimte__node_list' });

        await run.backend.dispose();
    });

    test('steers a running prompt with a second session/prompt, within one turn', async () => {
        const frames = steerFixture.frames as AcpTimedFrame[];
        const prompts = frames.filter((entry) => entry.frame.method === 'session/prompt');
        const run = replay(frames);

        expect(run.provider.capabilities.steer).toBe(true);

        await run.backend.start();
        run.backend.sendTurn(turn('sleep'));
        await run.player.playTo(prompts[1]!.t);
        const steered = run.backend.steerTurn?.(turn('banana'));
        await run.player.playTo(frames.at(-1)!.t);

        expect(await steered).toBe(true);
        expect(run.methods().filter((method) => method === 'session/prompt')).toHaveLength(2);
        expect(run.events.filter((event) => event.type === 'turn.done')).toMatchObject([{ promptId: 'prompt-sleep', state: 'done' }]);

        await run.backend.dispose();
    });
});

describe("the host's seams", () => {
    const HOST_ENV = { HOST_MCP_URL: 'http://127.0.0.1:4000/mcp', HOST_TOKEN: 'chat-token' };
    const HOST_SERVER = { type: 'http', name: 'host', url: 'http://127.0.0.1:4000/mcp', headers: [{ name: 'Authorization', value: 'Bearer chat-token' }] };

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
        ['Antigravity', () => createAntigravityProvider({ launch: withHostServer })]
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
