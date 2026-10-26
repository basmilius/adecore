import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { BackendEvent, BackendLaunch } from '../chat/backend.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { fakeAcp, fakeAcpWith } from '../testing/fake-acp.ts';
import { UsageScanner } from '../usage/scanner.ts';
import { ACP_CAPABILITIES, createAcpProvider } from './acp-provider.ts';
import { ModelCatalog } from './catalog.ts';
import { ProviderRegistry } from './registry.ts';

const catalog = new ModelCatalog({
    defaultModel: 'fake-small',
    profiles: { standard: { options: [], contextWindowTokens: {} } },
    models: [{ slug: 'fake-small', name: 'Fake small', profile: 'standard' }]
});

test('a provider spec becomes a chat provider whose backend speaks ACP', async () => {
    const provider = createAcpProvider({
        kind: 'example',
        name: 'Example',
        command: 'example',
        args: ['agent', 'stdio'],
        catalog,
        capabilities: { reportsCost: true }
    });

    expect(provider.command).toEqual(['example', 'agent', 'stdio']);
    expect(provider.capabilities).toEqual({ ...ACP_CAPABILITIES, reportsCost: true });
    expect(provider.resumeCommand).toBe('');
    expect(() => provider.firstPromptArgs('hello')).toThrow('Example is only available as a chat.');
    const fake = inProcess(fakeAcp);

    const backend = provider.createBackend(
        {
            command: provider.command,
            cwd: '/tmp',
            env: {},
            selection: catalog.normalize(undefined),
            modelName: 'Fake small',
            runtimeMode: 'supervised',
            resume: null,
            generation: 1,
            instructions: null,
            resumeNote: null,
            spawn: fake.spawn
        },
        { onEvent: () => undefined }
    );

    await backend.start();
    expect(fake.started[0]?.argv).toEqual(['agent', 'stdio']);
    await backend.dispose();
});

function launchOn(provider: ReturnType<typeof createAcpProvider>, model: string, spawn: BackendLaunch['spawn']): BackendLaunch {
    const selection = provider.catalog.normalize({ model });

    return {
        command: provider.command,
        cwd: '/tmp',
        env: {},
        selection,
        modelName: provider.catalog.nameOf(selection.model),
        runtimeMode: 'supervised',
        resume: null,
        generation: 1,
        instructions: null,
        resumeNote: null,
        ...(spawn ? { spawn } : {})
    };
}

function agentDefault(): ModelCatalog {
    return new ModelCatalog({
        defaultModel: 'default',
        profiles: { agent: { options: [], contextWindowTokens: {} } },
        models: [{ slug: 'default', name: 'Default', profile: 'agent' }]
    });
}

test('takes the models a session reports, so a later chat can pick one', async () => {
    const provider = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault() });
    const first = inProcess(fakeAcp);
    const backend = provider.createBackend(launchOn(provider, 'default', first.spawn), { onEvent: () => undefined });
    await backend.start();
    await backend.dispose();
    expect(provider.catalog.defaultModel).toBe('fake-small');
    expect(provider.catalog.list().map((model) => [model.slug, model.name])).toEqual([
        ['fake-small', 'Fake small'],
        ['fake-large', 'Fake large']
    ]);

    const sent: string[] = [];

    const second = inProcess((io) => {
        const program = fakeAcp(io);

        return {
            onLine: (line) => {
                sent.push(line);
                program.onLine(line);
            }
        };
    });

    const events: BackendEvent[] = [];
    const chat = provider.createBackend(launchOn(provider, 'fake-large', second.spawn), { onEvent: (event) => events.push(event) });
    await chat.start();
    await chat.dispose();
    expect(sent.some((line) => line.includes('"session/set_config_option"') && line.includes('"fake-large"'))).toBe(true);
    expect(events.find((event) => event.type === 'session')).toMatchObject({ model: 'fake-large' });
});

test('takes the reasoning effort a session reports as the effort option, with its labels and its current value as the default', async () => {
    const withEffort = new ModelCatalog({
        defaultModel: 'default',
        profiles: {
            agent: {
                options: [
                    { id: 'effort', label: 'Reasoning', type: 'select', defaultChoice: 'medium', choices: [{ id: 'medium', label: 'Medium' }] },
                    { id: 'fast', label: 'Fast', type: 'boolean', defaultValue: false }
                ],
                contextWindowTokens: {}
            }
        },
        models: [{ slug: 'default', name: 'Default', profile: 'agent' }]
    });

    const provider = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: withEffort });
    const fake = inProcess(fakeAcpWith({ reasoningEffort: 'accept' }));
    const backend = provider.createBackend(launchOn(provider, 'default', fake.spawn), { onEvent: () => undefined });
    await backend.start();
    await backend.dispose();
    const small = provider.catalog.list().find((model) => model.slug === 'fake-small');

    expect(small?.options).toEqual([
        { id: 'fast', label: 'Fast', type: 'boolean', defaultValue: false },
        {
            id: 'effort',
            label: 'Reasoning',
            type: 'select',
            defaultChoice: 'low',
            choices: [
                { id: 'low', label: 'Low', description: 'Answers quickly' },
                { id: 'high', label: 'High' }
            ]
        }
    ]);
    expect(provider.catalog.normalize({ model: 'fake-small' }).options).toEqual({ fast: false, effort: 'low' });
});

test('keeps its own catalog where the agent reports no models or the spec says so', async () => {
    const kept = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault(), adoptModels: false });
    const fake = inProcess(fakeAcp);
    const backend = kept.createBackend(launchOn(kept, 'default', fake.spawn), { onEvent: () => undefined });
    await backend.start();
    await backend.dispose();
    expect(kept.catalog.list().map((model) => model.slug)).toEqual(['default']);
    expect(agentDefault().adopt([], 'default')).toBe(false);
});

test('reads its accounts over ACP unless the spec opts out', () => {
    expect(createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault() }).askAccount).toBeFunction();
    expect(
        createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault(), accountProbe: false }).askAccount
    ).toBeUndefined();
});

const TURN_USAGE = { totalTokens: 1500, inputTokens: 1100, outputTokens: 400, cachedReadTokens: 1000 };

/* One turn of a provider on a fake agent that reports `TURN_USAGE`. */
async function oneTurn(provider: ReturnType<typeof createAcpProvider>): Promise<void> {
    const fake = inProcess(fakeAcpWith({ turnUsage: TURN_USAGE }));

    let done: () => void = () => undefined;

    const ended = new Promise<void>((resolve) => {
        done = resolve;
    });

    const backend = provider.createBackend(launchOn(provider, 'fake-small', fake.spawn), {
        onEvent: (event) => {
            if (event.type === 'turn.done') {
                done();
            }
        }
    });

    await backend.start();
    backend.sendTurn({ promptId: 'p-1', text: 'hello', preamble: null, attachments: [], mentions: [], skills: [] });
    await ended;
    await backend.dispose();
}

test('logs the usage a turn reports to the folder the host names, for the scanner to read as a host log', async () => {
    const base = await mkdtemp(join(tmpdir(), 'acp-usage-'));

    try {
        const folder = join(base, 'example-usage');
        const provider = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault(), usageLog: folder });
        await oneTurn(provider);
        // The root's provider is whichever the host logs the agent under; any the usage page knows will do here.
        const scanner = new UsageScanner(join(base, 'home'), [{ provider: 'nanogpt', path: folder }]);
        await scanner.scan();

        expect(scanner.records()).toMatchObject([
            { model: 'fake-small', cwd: '/tmp', totals: { calls: 1, input: 100, cacheRead: 1000, cacheWrite: 0, output: 400, reasoning: 0 } }
        ]);
        expect(scanner.records()[0]!.sessionId).not.toBe('');
    } finally {
        await rm(base, { recursive: true, force: true });
    }
});

test('logs nothing for an agent whose own usage files are read', async () => {
    const base = await mkdtemp(join(tmpdir(), 'acp-usage-'));

    try {
        const folder = join(base, 'grok-usage');
        await oneTurn(createAcpProvider({ kind: 'grok', name: 'Grok', command: 'grok', catalog: agentDefault(), usageLog: folder }));
        expect(await readdir(base)).toEqual([]);
    } finally {
        await rm(base, { recursive: true, force: true });
    }
});

/* A store in memory, as a host keeps one in a file. */
function memoryStore(initial?: unknown): { load(): unknown; save(value: unknown): void; saved: unknown[] } {
    const saved: unknown[] = initial === undefined ? [] : [initial];

    return {
        saved,
        load: () => saved.at(-1),
        save: (value) => {
            saved.push(JSON.parse(JSON.stringify(value)));
        }
    };
}

async function oneSession(provider: ReturnType<typeof createAcpProvider>, options: Parameters<typeof fakeAcpWith>[0] = {}): Promise<BackendEvent[]> {
    const fake = inProcess(fakeAcpWith(options));
    const events: BackendEvent[] = [];
    const backend = provider.createBackend(launchOn(provider, provider.catalog.defaultModel, fake.spawn), { onEvent: (event) => events.push(event) });
    await backend.start();
    await backend.dispose();

    return events;
}

test('keeps the models a session reported in the host store, so a provider made after a restart offers them at once', async () => {
    const store = memoryStore();
    const provider = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault(), catalogStore: store });
    let changes = 0;
    provider.onChange?.(() => changes++);
    await oneSession(provider, { reasoningEffort: 'accept' });
    expect(changes).toBe(1);
    expect(store.saved).toHaveLength(1);
    await oneSession(provider, { reasoningEffort: 'accept' });
    expect(changes).toBe(1);

    const restarted = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault(), catalogStore: store });
    expect(restarted.catalog.defaultModel).toBe('fake-small');
    expect(restarted.catalog.list()).toEqual(provider.catalog.list());
});

test('writes the effort names a store kept in lowercase with a capital, and keeps their ids', () => {
    const effort = {
        id: 'effort',
        label: 'Reasoning',
        type: 'select' as const,
        defaultChoice: 'max',
        choices: [
            { id: 'low', label: 'low' },
            { id: 'max', label: 'max' }
        ]
    };

    const provider = createAcpProvider({
        kind: 'example',
        name: 'Example',
        command: 'example',
        catalog: agentDefault(),
        catalogStore: memoryStore({ models: { defaultModel: 'kept', models: [{ slug: 'kept', name: 'Kept' }], options: [effort] } })
    });

    expect(provider.catalog.list()[0]?.options).toContainEqual({
        ...effort,
        choices: [
            { id: 'low', label: 'Low' },
            { id: 'max', label: 'Max' }
        ]
    });
});

test('starts from its own catalog when the store holds nothing it can read or cannot be read at all', () => {
    const garbage = createAcpProvider({
        kind: 'example',
        name: 'Example',
        command: 'example',
        catalog: agentDefault(),
        catalogStore: memoryStore({ models: { defaultModel: 'gone', models: [{ slug: 'other', name: 'Other' }], options: [] } })
    });

    expect(garbage.catalog.list().map((model) => model.slug)).toEqual(['default']);

    const failing = createAcpProvider({
        kind: 'example',
        name: 'Example',
        command: 'example',
        catalog: agentDefault(),
        catalogStore: {
            load: () => {
                throw new Error('unreadable');
            },
            save: () => undefined
        }
    });

    expect(failing.catalog.list().map((model) => model.slug)).toEqual(['default']);
});

test('the registry passes on the kind of a provider whose models changed', async () => {
    const provider = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault() });
    const registry = new ProviderRegistry({ providers: [provider], detect: async () => ({ installed: true, version: '1' }), env: {} });
    const kinds: string[] = [];
    const stop = registry.onChange((kind) => kinds.push(kind));
    await oneSession(provider);
    stop();
    expect(kinds).toEqual(['example']);
    expect((await registry.list())[0]?.models.map((model) => model.slug)).toEqual(['fake-small', 'fake-large']);
});

test('gives each adopted model the context window the agent names for it, and keeps it across a restart', async () => {
    const store = memoryStore();
    const provider = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault(), catalogStore: store });
    await oneSession(provider, { contextWindows: true, legacyModels: true });
    expect(provider.catalog.contextWindowFor(provider.catalog.normalize({ model: 'fake-small' }))).toBe(128000);
    expect(provider.catalog.contextWindowFor(provider.catalog.normalize({ model: 'fake-large' }))).toBe(1000000);
    const restarted = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault(), catalogStore: store });
    expect(restarted.catalog.contextWindowFor(restarted.catalog.normalize({ model: 'fake-large' }))).toBe(1000000);
});

test('reports the context window once the agent sent one in a usage update, and remembers that', async () => {
    const store = memoryStore();
    const provider = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault(), catalogStore: store });
    const listed = provider.capabilities;
    await oneSession(provider);
    expect(provider.capabilities.reportsContextWindow).toBe(false);
    let changes = 0;
    provider.onChange?.(() => changes++);
    await oneTurn(provider);
    expect(changes).toBe(1);
    expect(listed.reportsContextWindow).toBe(true);
    await oneTurn(provider);
    expect(changes).toBe(1);
    const restarted = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault(), catalogStore: store });
    expect(restarted.capabilities.reportsContextWindow).toBe(true);

    const overridden = createAcpProvider({
        kind: 'example',
        name: 'Example',
        command: 'example',
        catalog: agentDefault(),
        catalogStore: store,
        capabilities: { reportsContextWindow: false }
    });

    expect(overridden.capabilities.reportsContextWindow).toBe(false);
});

test('folds the context with a prompt and sends goals as a command where the agent lists those commands, also after a restart', async () => {
    const store = memoryStore();
    const provider = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault(), catalogStore: store });
    expect(provider.capabilities.compaction).toBe('none');
    expect(provider.capabilities.goals).toBeUndefined();
    let changes = 0;
    provider.onChange?.(() => changes++);
    await oneSession(provider, { commands: ['compact', 'goal', 'context'] });
    expect(provider.capabilities).toMatchObject({ compaction: 'prompt', goals: 'command' });
    const restarted = createAcpProvider({ kind: 'example', name: 'Example', command: 'example', catalog: agentDefault(), catalogStore: store });
    expect(restarted.capabilities).toMatchObject({ compaction: 'prompt', goals: 'command' });

    const before = changes;
    await oneSession(provider, { commands: ['context'] });
    expect(provider.capabilities.compaction).toBe('none');
    expect(provider.capabilities).not.toHaveProperty('goals');
    expect(changes).toBe(before + 1);
});
