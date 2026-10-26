import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'bun:test';
import type { ChatAttachment, RuntimeMode } from '@adecore/agent-contracts';
import { fakeAcpWith, type FakeAcpOptions } from '../testing/fake-acp.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { createAcpBackend, type AcpAgentSpec, type AcpUsageReport } from './acp-backend.ts';
import type { AcpPermissionRequest, AcpSessionInfo } from './acp-protocol.ts';
import type { BackendEvent, BackendLaunch, ChatBackend, TurnInput } from './backend.ts';

type Frame = { id?: unknown; method?: string; params?: Record<string, unknown>; result?: unknown; error?: unknown };

const SPEC: AcpAgentSpec = {
    name: 'Fake',
    modes: { supervised: ['ask'], 'auto-accept-edits': ['edit'], 'full-access': ['yolo'] }
};

const launch: BackendLaunch = {
    command: ['fake-acp'],
    cwd: '/tmp',
    env: {},
    selection: { model: 'fake-small', options: {} },
    modelName: 'Fake small',
    runtimeMode: 'supervised',
    resume: null,
    generation: 1,
    instructions: null,
    resumeNote: null
};

function turn(text: string): TurnInput {
    return { promptId: `prompt-${text}`, text, preamble: null, attachments: [], mentions: [], skills: [] };
}

/* A backend on the fake agent, the events it raised, and every frame the client sent. */
function run(options: FakeAcpOptions = {}, overrides: Partial<BackendLaunch> = {}, spec: AcpAgentSpec = SPEC) {
    const sent: Frame[] = [];
    const events: BackendEvent[] = [];
    const waiters: Array<{ match(event: BackendEvent): boolean; resolve(event: BackendEvent): void }> = [];

    const fake = inProcess((io) => {
        const program = fakeAcpWith(options)(io);

        return {
            onLine: (line) => {
                sent.push(JSON.parse(line) as Frame);
                program.onLine(line);
            }
        };
    });

    const backend: ChatBackend = createAcpBackend(spec)(
        { ...launch, ...overrides, spawn: fake.spawn },
        {
            onEvent: (event) => {
                events.push(event);

                for (const waiter of waiters.splice(0)) {
                    if (waiter.match(event)) {
                        waiter.resolve(event);
                    } else {
                        waiters.push(waiter);
                    }
                }
            }
        }
    );

    /* The next event that matches, or one already raised. */
    const next = <T extends BackendEvent['type']>(type: T, match: (event: Extract<BackendEvent, { type: T }>) => boolean = () => true) => {
        const fits = (event: BackendEvent): boolean => event.type === type && match(event as Extract<BackendEvent, { type: T }>);

        const raised = events.find(fits);

        if (raised) {
            return Promise.resolve(raised as Extract<BackendEvent, { type: T }>);
        }

        return new Promise<Extract<BackendEvent, { type: T }>>((resolve) => {
            waiters.push({ match: fits, resolve: (event) => resolve(event as Extract<BackendEvent, { type: T }>) });
        });
    };

    return { backend, events, sent, next, methods: () => sent.flatMap((frame) => (frame.method ? [frame.method] : [])) };
}

function sessionOf(events: BackendEvent[]): string {
    const session = events.find((event) => event.type === 'session');

    return session?.type === 'session' ? (session.agentSessionId ?? '') : '';
}

test('a turn opens a session, carries the instructions in front of the first prompt and ends on the prompt response', async () => {
    const fake = run({}, { instructions: 'Be brief.' });
    await fake.backend.start();
    expect(fake.methods()).toEqual(['initialize', 'session/new']);
    expect(fake.sent[0]).toMatchObject({
        jsonrpc: '2.0',
        params: { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } }
    });
    expect(fake.events[0]).toMatchObject({ type: 'session', model: 'fake-small', effectiveRuntimeMode: 'supervised', permissionMode: 'ask' });
    fake.backend.sendTurn(turn('hello'));
    const done = await fake.next('turn.done');
    expect(done).toEqual({ type: 'turn.done', promptId: 'prompt-hello', costUsd: 0.01, state: 'done' });
    expect(fake.events.find((event) => event.type === 'text.done')).toMatchObject({ text: 'echo: Be brief.\n\nhello' });
    expect(fake.events.some((event) => event.type === 'thinking.done')).toBe(true);
    expect(fake.events.find((event) => event.type === 'usage')).toEqual({ type: 'usage', contextTokens: 1200, contextWindow: 200000, costUsd: 0.01 });
    fake.backend.sendTurn(turn('again'));
    await fake.next('turn.done', (event) => event.promptId === 'prompt-again');
    expect(fake.events.filter((event) => event.type === 'text.done').at(-1)).toMatchObject({ text: 'echo: again' });
    await fake.backend.dispose();
});

test('a turn whose response reports usage hands it to the spec, with the session, folder and model it ran in', async () => {
    const reports: AcpUsageReport[] = [];
    const usage = { totalTokens: 1500, inputTokens: 1100, outputTokens: 400, thoughtTokens: 50, cachedReadTokens: 1000 };
    const fake = run({ turnUsage: usage }, { selection: { model: 'fake-large', options: {} } }, { ...SPEC, onUsage: (report) => reports.push(report) });
    await fake.backend.start();
    fake.backend.sendTurn(turn('hello'));
    await fake.next('turn.done');

    expect(reports).toEqual([
        { sessionId: sessionOf(fake.events), cwd: '/tmp', model: 'fake-large', input: 100, cacheRead: 1000, cacheWrite: 0, output: 400, reasoning: 50 }
    ]);

    await fake.backend.dispose();
});

test('a turn without usage reports nothing', async () => {
    const reports: AcpUsageReport[] = [];
    const fake = run({}, {}, { ...SPEC, onUsage: (report) => reports.push(report) });
    await fake.backend.start();
    fake.backend.sendTurn(turn('hello'));
    await fake.next('turn.done');
    expect(reports).toEqual([]);
    await fake.backend.dispose();
});

test('a permission request becomes an approval, and the answer goes back as the option the agent offered', async () => {
    const fake = run();
    await fake.backend.start();
    fake.backend.sendTurn(turn('tool: ls'));
    const approval = await fake.next('approval.requested');
    expect(approval).toMatchObject({ toolName: 'Bash', input: { command: 'ls' }, description: 'Run ls', canAllowAlways: true });
    expect(fake.backend.respondApproval(approval.requestId, 'allow-always')).toBe(true);
    expect(fake.backend.respondApproval(approval.requestId, 'allow')).toBe(false);
    await fake.next('turn.done');
    expect(fake.sent.find((frame) => frame.method === undefined)).toMatchObject({ result: { outcome: { outcome: 'selected', optionId: 'always' } } });
    expect(fake.events.find((event) => event.type === 'tool.done')).toEqual({ type: 'tool.done', ref: 'call-1', output: 'ran ls (always)', state: 'done' });
    await fake.backend.dispose();
});

test('a denial goes back as the reject option and the call fails', async () => {
    const fake = run();
    await fake.backend.start();
    fake.backend.sendTurn(turn('tool: rm -rf build'));
    const approval = await fake.next('approval.requested');
    fake.backend.respondApproval(approval.requestId, 'deny');
    await fake.next('turn.done');
    expect(fake.events.find((event) => event.type === 'tool.done')).toMatchObject({ state: 'error', output: 'rejected' });
    await fake.backend.dispose();
});

for (const [runtimeMode, prompt, asks] of [
    ['full-access', 'tool: ls', false],
    ['auto-accept-edits', 'edit: notes.md', false],
    ['auto-accept-edits', 'tool: ls', true]
] as Array<[RuntimeMode, string, boolean]>) {
    test(`an agent without modes in ${runtimeMode} ${asks ? 'still asks' : 'is answered by the backend'} for "${prompt}"`, async () => {
        const fake = run({ modes: [] }, { runtimeMode });
        await fake.backend.start();
        expect(fake.events[0]).not.toHaveProperty('permissionMode');
        fake.backend.sendTurn(turn(prompt));

        if (asks) {
            await fake.next('approval.requested');
            expect(fake.events.some((event) => event.type === 'turn.done')).toBe(false);
        } else {
            await fake.next('turn.done');
            expect(fake.events.some((event) => event.type === 'approval.requested')).toBe(false);
            expect(fake.sent.find((frame) => frame.method === undefined)).toMatchObject({ result: { outcome: { outcome: 'selected', optionId: 'once' } } });
        }

        await fake.backend.dispose();
    });
}

test("a request the host's autoAllow passes is allowed once without an approval, and the call still shows", async () => {
    const asked: AcpPermissionRequest[] = [];

    const autoAllow = (request: AcpPermissionRequest): boolean => {
        asked.push(request);

        return true;
    };

    const fake = run({}, {}, { ...SPEC, autoAllow });
    await fake.backend.start();
    fake.backend.sendTurn(turn('tool: ruimte-context help'));
    await fake.next('turn.done');
    expect(asked).toEqual([{ kind: 'execute', title: 'Run ruimte-context help', commands: ['ruimte-context help'] }]);
    expect(fake.events.some((event) => event.type === 'approval.requested')).toBe(false);
    expect(fake.events.find((event) => event.type === 'tool.started')).toMatchObject({ name: 'Bash', input: { command: 'ruimte-context help' } });
    expect(fake.sent.find((frame) => frame.method === undefined)).toMatchObject({ result: { outcome: { outcome: 'selected', optionId: 'once' } } });
    await fake.backend.dispose();
});

for (const [label, autoAllow] of [
    ['declines', () => false],
    [
        'throws on',
        () => {
            throw new Error('broken');
        }
    ]
] as Array<[string, () => boolean]>) {
    test(`a request the host's autoAllow ${label} becomes an approval`, async () => {
        const fake = run({}, {}, { ...SPEC, autoAllow });
        await fake.backend.start();
        fake.backend.sendTurn(turn('tool: rm -rf build'));
        expect(await fake.next('approval.requested')).toMatchObject({ toolName: 'Bash', input: { command: 'rm -rf build' } });
        expect(fake.sent.some((frame) => frame.method === undefined)).toBe(false);
        await fake.backend.dispose();
    });
}

test('a cancel ends a running turn on the response the agent sends after it', async () => {
    const fake = run();
    await fake.backend.start();
    fake.backend.sendTurn(turn('slow'));
    await fake.next('text.delta');
    fake.backend.interrupt();
    expect(await fake.next('turn.done')).toEqual({ type: 'turn.done', promptId: 'prompt-slow', costUsd: 0.01, state: 'aborted' });
    expect(fake.methods().at(-1)).toBe('session/cancel');
    await fake.backend.dispose();
});

test('a cancel answers an open permission request as cancelled and withdraws it', async () => {
    const fake = run();
    await fake.backend.start();
    fake.backend.sendTurn(turn('tool: ls'));
    const approval = await fake.next('approval.requested');
    fake.backend.interrupt();
    expect(await fake.next('turn.done')).toMatchObject({ state: 'aborted' });
    expect(fake.events).toContainEqual({ type: 'request.withdrawn', requestId: approval.requestId });
    expect(fake.sent.find((frame) => frame.method === undefined)).toMatchObject({ result: { outcome: { outcome: 'cancelled' } } });
    expect(fake.backend.respondApproval(approval.requestId, 'allow')).toBe(false);
    await fake.backend.dispose();
});

test('an interrupt between turns ends the turn the session opened', async () => {
    const fake = run();
    await fake.backend.start();
    fake.backend.interrupt();
    expect(await fake.next('turn.done')).toEqual({ type: 'turn.done', state: 'aborted', costUsd: 0 });
    await fake.backend.dispose();
});

test('a resume loads the session without replaying its history into the thread, and repeats the resume note', async () => {
    const first = run();
    await first.backend.start();
    const sessionId = sessionOf(first.events);
    first.backend.sendTurn(turn('hello'));
    await first.next('turn.done');
    await first.backend.dispose();

    const second = run({}, { resume: sessionId, generation: 2, instructions: 'Never repeated.', resumeNote: 'Linked context.' });
    await second.backend.start();
    expect(second.methods()).toEqual(['initialize', 'session/load']);
    expect(sessionOf(second.events)).toBe(sessionId);
    second.backend.sendTurn(turn('history?'));
    await second.next('turn.done');
    const texts = second.events.flatMap((event) => (event.type === 'text.done' ? [event.text] : []));
    expect(texts).toEqual(['prompts before: 1']);
    const prompt = second.sent.find((frame) => frame.method === 'session/prompt')?.params?.prompt as Array<{ text: string }>;
    expect(prompt[0]?.text).toBe('Linked context.\n\nhistory?');
    await second.backend.dispose();
});

test('an agent that can resume is resumed rather than loaded', async () => {
    const first = run({ resumeSession: true });
    await first.backend.start();
    const sessionId = sessionOf(first.events);
    await first.backend.dispose();
    const second = run({ resumeSession: true }, { resume: sessionId, generation: 2 });
    await second.backend.start();
    expect(second.methods()).toEqual(['initialize', 'session/resume']);
    await second.backend.dispose();
});

test('a session the agent no longer has, or cannot continue, starts a new one with a note', async () => {
    const gone = run({}, { resume: 'no-such-session' });
    await gone.backend.start();
    expect(gone.methods()).toEqual(['initialize', 'session/load', 'session/new']);
    expect(gone.events[0]).toMatchObject({ type: 'note', level: 'warning' });
    await gone.backend.dispose();
    const unable = run({ loadSession: false }, { resume: 'any' });
    await unable.backend.start();
    expect(unable.methods()).toEqual(['initialize', 'session/new']);
    expect(unable.events[0]).toMatchObject({ type: 'note', text: 'Fake cannot continue a session it ran before. Started a new one.' });
    await unable.backend.dispose();
});

test('the runtime mode picks the agent mode, the selection the model, and the host hears what the session offers', async () => {
    const sessions: AcpSessionInfo[] = [];

    const fake = run(
        {},
        { runtimeMode: 'full-access', selection: { model: 'fake-large', options: {} } },
        { ...SPEC, onSession: (info) => sessions.push(info) }
    );

    await fake.backend.start();

    expect(fake.sent.filter((frame) => frame.method?.startsWith('session/set')).map((frame) => [frame.method, frame.params])).toEqual([
        ['session/set_mode', { sessionId: sessionOf(fake.events), modeId: 'yolo' }],
        ['session/set_config_option', { sessionId: sessionOf(fake.events), configId: 'model', value: 'fake-large' }]
    ]);
    expect(sessions[0]?.models?.models.map((model) => model.id)).toEqual(['fake-small', 'fake-large']);
    expect(fake.events.find((event) => event.type === 'session')).toMatchObject({ model: 'fake-large', permissionMode: 'yolo' });
    fake.backend.sendTurn(turn('mode?'));
    await fake.next('turn.done');
    expect(fake.events.filter((event) => event.type === 'text.done').at(-1)).toMatchObject({ text: 'mode: yolo, model: fake-large' });
    await fake.backend.dispose();
});

test('an effort is set after the model, against the efforts the selected model offers', async () => {
    const fake = run({ reasoningEffort: 'accept' }, { selection: { model: 'fake-large', options: { effort: 'xhigh' } } });
    await fake.backend.start();

    expect(fake.sent.filter((frame) => frame.method === 'session/set_config_option').map((frame) => frame.params)).toEqual([
        { sessionId: sessionOf(fake.events), configId: 'model', value: 'fake-large' },
        { sessionId: sessionOf(fake.events), configId: 'reasoning_effort', value: 'xhigh' }
    ]);
    expect(fake.events.some((event) => event.type === 'note')).toBe(false);
    await fake.backend.dispose();

    const unchanged = run({ reasoningEffort: 'accept' }, { selection: { model: 'fake-small', options: { effort: 'low' } } });
    await unchanged.backend.start();
    expect(unchanged.methods()).not.toContain('session/set_config_option');
    await unchanged.backend.dispose();
});

test('an effort the agent refuses leaves a note and the session starts', async () => {
    const fake = run({ reasoningEffort: 'reject' }, { selection: { model: 'fake-small', options: { effort: 'high' } } });
    await fake.backend.start();

    expect(fake.events).toContainEqual({
        type: 'note',
        level: 'warning',
        text: 'Fake kept its reasoning at Low instead of High.'
    });

    fake.backend.sendTurn(turn('hello'));
    expect(await fake.next('turn.done')).toMatchObject({ state: 'done' });
    await fake.backend.dispose();
});

test('models reported the older way are switched with session/set_model, and an unknown one leaves the agent its own', async () => {
    const legacy = run({ legacyModels: true }, { selection: { model: 'fake-large', options: {} } });
    await legacy.backend.start();
    expect(legacy.methods()).toContain('session/set_model');
    await legacy.backend.dispose();
    const unknown = run({}, { selection: { model: 'fake-huge', options: {} }, modelName: 'Fake huge' });
    await unknown.backend.start();
    expect(unknown.methods()).not.toContain('session/set_config_option');
    expect(unknown.events).toContainEqual({ type: 'note', level: 'warning', text: 'Fake does not offer Fake huge. It runs fake-small.' });
    await unknown.backend.dispose();
});

test('a mode wider than the runtime mode, with nothing narrower on offer, refuses to start', async () => {
    const fake = run({ modes: ['yolo'] });
    await expect(fake.backend.start()).rejects.toThrow('Fake runs in yolo, which allows more than supervised, and offers no narrower mode');
    expect(fake.backend.running).toBe(false);
});

test('an agent that needs a login is authenticated with the method the spec names, or fails with the hint', async () => {
    const signed = run({ authMethod: 'token' }, {}, { ...SPEC, authMethod: 'token' });
    await signed.backend.start();
    expect(signed.methods()).toEqual(['initialize', 'session/new', 'authenticate', 'session/new']);
    await signed.backend.dispose();
    const unsigned = run({ authMethod: 'token' }, {}, { ...SPEC, loginHint: 'Run `fake login` in a terminal.' });
    await expect(unsigned.backend.start()).rejects.toThrow('Fake is not signed in. Run `fake login` in a terminal.');
});

test('an image goes along as an image block, and one that cannot be read refuses the turn', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'acp-image-'));
    const path = join(folder, 'shot.png');
    writeFileSync(path, Buffer.from('iVBORw0KGgo=', 'base64'));
    const image = { id: 'a', name: 'shot.png', mime: 'image/png', path, size: 8 } as unknown as ChatAttachment;
    const fake = run();
    await fake.backend.start();
    fake.backend.sendTurn({ ...turn('look'), attachments: [image] });
    await fake.next('turn.done');
    const prompt = fake.sent.find((frame) => frame.method === 'session/prompt')?.params?.prompt as Array<Record<string, unknown>>;
    expect(prompt.map((block) => block.type)).toEqual(['text', 'image']);
    expect(prompt[1]).toEqual({ type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' });
    expect(() => fake.backend.sendTurn({ ...turn('again'), attachments: [{ ...image, path: join(folder, 'gone.png') }] })).toThrow(
        'Could not read attached image "shot.png". Attach it again and retry.'
    );

    await fake.backend.dispose();
    rmSync(folder, { recursive: true, force: true });
});

test('a crash during a turn is the exit, not a second turn end', async () => {
    const fake = run();
    await fake.backend.start();
    fake.backend.sendTurn(turn('crash'));
    expect(await fake.next('exit')).toMatchObject({ exitCode: 1 });
    expect(fake.events.some((event) => event.type === 'turn.done')).toBe(false);
    expect(fake.backend.running).toBe(false);
});

test('the commands an agent lists before it names the session reach the thread and the spec', async () => {
    const listed: string[][] = [];
    const fake = run({ commands: ['compact', 'goal'] }, {}, { ...SPEC, onCommands: (commands) => listed.push(commands) });
    await fake.backend.start();
    const session = fake.events.findIndex((event) => event.type === 'session' && event.agentSessionId !== null);
    expect(fake.events.slice(session + 1)).toContainEqual({ type: 'session', agentSessionId: null, model: null, slashCommands: ['compact', 'goal'] });
    expect(listed).toEqual([['compact', 'goal']]);
    await fake.backend.dispose();
});

test('compact sends the agent its own command as a prompt where it lists one, and says it cannot elsewhere', async () => {
    const listing = run({ commands: ['compact'] });
    await listing.backend.start();
    listing.backend.compact();
    await listing.next('turn.done');
    const prompt = listing.sent.find((frame) => frame.method === 'session/prompt');
    expect(prompt?.params?.prompt).toEqual([{ type: 'text', text: '/compact' }]);
    await listing.backend.dispose();

    const silent = run();
    await silent.backend.start();
    silent.backend.compact();
    expect(silent.events.find((event) => event.type === 'note')).toMatchObject({ text: 'Fake cannot compact its context.' });
    expect(silent.methods()).not.toContain('session/prompt');
    await silent.backend.dispose();
});

test('a mentioned text file inside the folder goes along as a resource block where the agent takes embedded context', async () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), 'acp-mention-')));
    const cwd = join(base, 'project');
    mkdirSync(join(cwd, 'src'), { recursive: true });
    writeFileSync(join(cwd, 'src', 'a.ts'), 'export const a = 1;\n');
    writeFileSync(join(cwd, 'big.txt'), 'x'.repeat(300 * 1024));
    writeFileSync(join(cwd, 'blob.bin'), Buffer.from([1, 0, 2]));
    writeFileSync(join(base, 'outside.txt'), 'secret');
    const mentions = ['src/a.ts', 'big.txt', 'blob.bin', '../outside.txt', join(base, 'outside.txt'), 'missing.ts', 'src'];

    const prompted = async (embeddedContext: boolean): Promise<Array<Record<string, unknown>>> => {
        const fake = run({ embeddedContext }, { cwd });
        await fake.backend.start();
        fake.backend.sendTurn({ ...turn('read @src/a.ts'), mentions });
        await fake.next('turn.done');
        await fake.backend.dispose();

        return fake.sent.find((frame) => frame.method === 'session/prompt')?.params?.prompt as Array<Record<string, unknown>>;
    };

    try {
        const embedded = await prompted(true);

        expect(embedded).toEqual([
            { type: 'text', text: 'read @src/a.ts' },
            { type: 'resource', resource: { uri: pathToFileURL(join(cwd, 'src', 'a.ts')).href, text: 'export const a = 1;\n' } }
        ]);
        expect(await prompted(false)).toEqual([{ type: 'text', text: 'read @src/a.ts' }]);
    } finally {
        rmSync(base, { recursive: true, force: true });
    }
});
