import { expect, test } from 'bun:test';
import agyDaemonCancel from '../chat/fixtures/antigravity-1.5.15-daemon-cancel.json';
import agyDaemonWake from '../chat/fixtures/antigravity-1.5.15-daemon-wake.json';
import agyMcpTurn from '../chat/fixtures/antigravity-1.5.15-mcp-turn.json';
import agySteer from '../chat/fixtures/antigravity-1.5.15-steer.json';
import agySubagent from '../chat/fixtures/antigravity-1.5.15-subagent.json';
import grokLoad from '../chat/fixtures/grok-1.0.70-load.json';
import { playAcpRecording, recordedAnswer, type AcpTimedFrame } from '../testing/fake-acp-capture.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { ManualClock } from '../testing/manual-clock.ts';
import { createAcpBackend, type AcpAgentSpec, type AcpUsageReport } from './acp-backend.ts';
import type { BackendEvent, BackendLaunch, TurnInput } from './backend.ts';

type Frame = AcpTimedFrame['frame'];

const launch: BackendLaunch = {
    command: ['agent'],
    cwd: '/tmp/capture',
    env: {},
    selection: { model: 'default', options: {} },
    modelName: 'Default',
    runtimeMode: 'supervised',
    resume: null,
    generation: 1,
    instructions: null,
    resumeNote: null
};

function turn(text: string): TurnInput {
    return { promptId: `prompt-${text}`, text, preamble: null, attachments: [], mentions: [], skills: [] };
}

/* A backend against the frames of a recording on a manual clock; `answers` holds what the recording does not answer itself. */
function replay(frames: readonly AcpTimedFrame[], spec: AcpAgentSpec, overrides: Partial<BackendLaunch> = {}, answers: Record<string, unknown> = {}) {
    const clock = new ManualClock();
    const player = playAcpRecording(frames, clock, answers);
    const events: BackendEvent[] = [];
    const fake = inProcess(player.cli);

    const backend = createAcpBackend(spec)({ ...launch, ...overrides, clock, spawn: fake.spawn }, { onEvent: (event) => events.push(event) });

    const methods = (): string[] => player.received.flatMap((frame) => (typeof frame.method === 'string' ? [frame.method] : []));

    return { backend, clock, events, player, methods };
}

function texts(events: readonly BackendEvent[]): string[] {
    return events.flatMap((event) => (event.type === 'text.done' ? [event.text] : []));
}

/*
 * Grok's recorded `session/load`, from an agent that offers no `session/resume`, so the backend loads. The prompt the
 * recording sent during the replay goes after the load's answer, where the backend sends its first prompt.
 */
function grokLoadFrames(live: Frame[] = []): AcpTimedFrame[] {
    const recorded = (grokLoad.frames as AcpTimedFrame[]).map(withoutResume);
    const prompt = recorded.find((entry) => entry.dir === 'in' && entry.frame.method === 'session/prompt')!;
    const answer = recorded.find((entry) => entry.dir === 'out' && entry.frame.method === undefined && entry.frame.id === 2)!;
    const lastReplayed = recorded.findLast((entry) => ((entry.frame.params as Frame | undefined)?._meta as Frame | undefined)?.isReplay === true)!;

    return recorded.flatMap((entry) => {
        if (entry === prompt) {
            return [];
        }

        if (entry === lastReplayed) {
            return [entry, ...live.map((frame) => ({ t: entry.t, dir: 'out', frame }))];
        }

        return entry === answer ? [entry, { ...prompt, t: entry.t }] : [entry];
    });
}

function withoutResume(entry: AcpTimedFrame): AcpTimedFrame {
    const result = entry.frame.result as { agentCapabilities?: { sessionCapabilities?: Record<string, unknown> } } | undefined;
    const capabilities = result?.agentCapabilities;

    if (capabilities?.sessionCapabilities === undefined) {
        return entry;
    }

    const { resume: _resume, ...sessionCapabilities } = capabilities.sessionCapabilities;

    return { ...entry, frame: { ...entry.frame, result: { ...result, agentCapabilities: { ...capabilities, sessionCapabilities } } } };
}

const GROK: AcpAgentSpec = { name: 'Grok', kind: 'grok', model: () => null };
const PROMPT_DONE = 3124;

test("a session Grok loads keeps its replayed history out of the thread, and the load's answer sets the session", async () => {
    const run = replay(grokLoadFrames(), GROK, { resume: 'id-3' });
    const starting = run.backend.start();
    await run.player.playTo(538);
    await starting;

    expect(run.methods()).toEqual(['initialize', 'session/load']);
    expect(run.events.filter((event) => event.type === 'text.delta' || event.type === 'text.done' || event.type === 'tool.started')).toEqual([]);
    expect(run.events.find((event) => event.type === 'session')).toMatchObject({ agentSessionId: 'id-3', model: 'grok-4.7' });

    run.backend.sendTurn(turn('early'));
    await run.player.playTo(PROMPT_DONE);

    expect(texts(run.events)).toEqual(['early']);
    expect(run.events.at(-1)).toMatchObject({ type: 'turn.done', promptId: 'prompt-early', state: 'done' });

    await run.backend.dispose();
});

test('the first frame without the replay mark ends the replay, so what the agent says live before the load answers reaches the thread', async () => {
    const live = {
        jsonrpc: '2.0',
        method: 'session/update',
        params: { sessionId: 'id-3', update: { sessionUpdate: 'usage_update', used: 40120, size: 256000 } }
    };
    const run = replay(grokLoadFrames([live]), GROK, { resume: 'id-3' });
    const starting = run.backend.start();
    await run.player.playTo(538);
    await starting;

    expect(run.events.filter((event) => event.type === 'usage')).toEqual([{ type: 'usage', contextTokens: 40120, contextWindow: 256000 }]);

    await run.backend.dispose();
});

// Antigravity 1.5 as a host would run it, its handshake answered as agy 1.5.15 answered it.
const AGY: AcpAgentSpec = {
    name: 'Antigravity',
    model: () => null,
    modes: { supervised: ['default'], 'full-access': ['default'] },
    repliesEndOnUsage: true,
    cancelsIdle: true
};

const mcpTurnFrames = agyMcpTurn.frames as AcpTimedFrame[];
const AGY_HANDSHAKE = { initialize: recordedAnswer(mcpTurnFrames, 'initialize'), 'session/new': recordedAnswer(mcpTurnFrames, 'session/new') };

function at(frames: readonly AcpTimedFrame[], match: (frame: Frame) => boolean): number {
    return frames.find((entry) => entry.dir !== 'in' && match(entry.frame))!.t;
}

const isPromptAnswer = (frame: Frame): boolean => frame.method === undefined && (frame.result as Frame | undefined)?.stopReason !== undefined;
const isUsage = (frame: Frame): boolean => ((frame.params as Frame | undefined)?.update as Frame | undefined)?.sessionUpdate === 'usage_update';

/* The texts and turn ends of a run, in order; a turn the agent opened itself ends without a prompt id. */
function timeline(events: readonly BackendEvent[]): string[] {
    return events.flatMap((event) => {
        if (event.type === 'text.done') {
            return [`text: ${event.text.trim()}`];
        }

        return event.type === 'turn.done' ? [`end ${event.promptId ?? 'wake'} ${event.state}`] : [];
    });
}

function chunk(text: string): Frame {
    return {
        jsonrpc: '2.0',
        method: 'session/update',
        params: { sessionId: 'id-1', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } } }
    };
}

function usage(used: number): Frame {
    return { jsonrpc: '2.0', method: 'session/update', params: { sessionId: 'id-1', update: { sessionUpdate: 'usage_update', used, size: 1048576 } } };
}

const wakeFrames = agyDaemonWake.frames as AcpTimedFrame[];
const DAEMONS_STARTED = at(wakeFrames, isPromptAnswer);
const FIRST_WAKE_ENDS = wakeFrames.filter((entry) => isUsage(entry.frame) && entry.t > DAEMONS_STARTED)[0]!.t;
const SECOND_WAKE_ENDS = wakeFrames.at(-1)!.t;
const FIRST_WAKE = 'The first command (`sleep 12 && echo one-done`) finished with `one-done`.';
const SECOND_WAKE = 'The second command (`sleep 24 && echo two-done`) finished with `two-done`.';

test('each wake after a daemon command is a turn of its own, which ends once no output follows its usage_update for three seconds', async () => {
    const run = replay(wakeFrames, AGY, { runtimeMode: 'full-access' }, AGY_HANDSHAKE);
    await run.backend.start();
    run.backend.sendTurn(turn('daemons'));
    await run.player.playTo(FIRST_WAKE_ENDS + 2_999);

    expect(timeline(run.events)).toEqual(['text: started', 'end prompt-daemons done']);

    await run.player.playTo(FIRST_WAKE_ENDS + 3_000);

    expect(timeline(run.events).slice(2)).toEqual([`text: ${FIRST_WAKE}`, 'end wake done']);

    await run.player.playTo(SECOND_WAKE_ENDS + 3_000);

    expect(timeline(run.events).slice(4)).toEqual([`text: ${SECOND_WAKE}`, 'end wake done']);

    await run.backend.dispose();
});

test('output within three seconds of the usage_update keeps the wake open until the usage_update after it', async () => {
    const more = [
        { t: FIRST_WAKE_ENDS + 2_000, dir: 'out', frame: chunk(' Waiting for the second.') },
        { t: FIRST_WAKE_ENDS + 2_100, dir: 'out', frame: usage(10400) }
    ];

    const frames = [...wakeFrames.filter((entry) => entry.t <= FIRST_WAKE_ENDS), ...more];
    const run = replay(frames, AGY, { runtimeMode: 'full-access' }, AGY_HANDSHAKE);
    await run.backend.start();
    run.backend.sendTurn(turn('daemons'));
    await run.player.playTo(FIRST_WAKE_ENDS + 5_099);

    expect(timeline(run.events).slice(2)).toEqual([]);

    await run.player.playTo(FIRST_WAKE_ENDS + 5_100);

    expect(timeline(run.events).slice(2)).toEqual([`text: ${FIRST_WAKE} Waiting for the second.`, 'end wake done']);

    await run.backend.dispose();
});

const cancelFrames = agyDaemonCancel.frames as AcpTimedFrame[];
const DAEMON_STARTED = at(cancelFrames, isPromptAnswer);
const DAEMON_STOPPED = cancelFrames.at(-1)!.t;

for (const cancelsIdle of [true, false]) {
    test(`a stop with no prompt open ${cancelsIdle ? 'sends session/cancel, which stops the daemon command' : 'leaves an agent that does not cancel idle alone'}`, async () => {
        const run = replay(cancelFrames, { ...AGY, cancelsIdle }, { runtimeMode: 'full-access' }, AGY_HANDSHAKE);
        await run.backend.start();
        run.backend.sendTurn(turn('daemon'));
        await run.player.playTo(DAEMON_STARTED);
        run.backend.interrupt();
        await run.player.playTo(DAEMON_STOPPED);

        expect(run.methods().slice(2)).toEqual(cancelsIdle ? ['session/prompt', 'session/cancel'] : ['session/prompt']);
        expect(timeline(run.events)).toEqual(['text: started', 'end prompt-daemon done', 'end wake aborted']);
        expect(run.events.filter((event) => event.type === 'tool.done').map((event) => event.type === 'tool.done' && [event.ref, event.state])).toEqual(
            cancelsIdle ? [['call_15227589526489405582', 'error']] : []
        );

        await run.backend.dispose();
    });
}

test('a stop with no prompt open withdraws the permission a wake asked for and answers it as cancelled', async () => {
    const asked = mcpTurnFrames
        .filter((entry) => entry.dir === 'out' && entry.t >= 5091 && entry.t <= 5947)
        .map((entry) => ({ ...entry, t: DAEMON_STARTED + 1_000 }));
    const frames = [...cancelFrames.filter((entry) => entry.t <= DAEMON_STARTED), ...asked];
    const run = replay(frames, AGY, {}, AGY_HANDSHAKE);
    await run.backend.start();
    run.backend.sendTurn(turn('daemon'));
    await run.player.playTo(DAEMON_STARTED - 1);
    const daemon = run.events.find((event) => event.type === 'approval.requested')!;
    run.backend.respondApproval(daemon.type === 'approval.requested' ? daemon.requestId : '', 'allow');
    await run.player.playTo(DAEMON_STARTED + 1_000);
    const wake = run.events.findLast((event) => event.type === 'approval.requested')!;
    run.backend.interrupt();
    await run.player.playTo(DAEMON_STARTED + 1_000);

    expect(wake).toMatchObject({ toolName: 'mcp_ruimte_node_list' });
    expect(run.player.received.at(-2)).toEqual({ jsonrpc: '2.0', id: '1', result: { outcome: { outcome: 'cancelled' } } });
    expect(run.player.received.at(-1)).toMatchObject({ method: 'session/cancel' });
    expect(run.events.slice(-2)).toEqual([
        { type: 'request.withdrawn', requestId: wake.type === 'approval.requested' ? wake.requestId : '' },
        { type: 'turn.done', state: 'aborted', costUsd: 0 }
    ]);

    await run.backend.dispose();
});

const AGY_TOOLS: AcpAgentSpec = { ...AGY, mcp: { http: true }, mcpToolPrefix: 'mcp_', daemonFlag: 'IsDaemon' };
const FIRST_MCP_PROMPT = mcpTurnFrames.find((entry) => entry.frame.method === 'session/prompt')!.t;
const FIRST_MCP_ANSWER = at(mcpTurnFrames, isPromptAnswer);

function approvals(events: readonly BackendEvent[]): Array<Extract<BackendEvent, { type: 'approval.requested' }>> {
    return events.flatMap((event) => (event.type === 'approval.requested' ? [event] : []));
}

for (const [server, named, asks] of [
    ['ruimte', 'mcp__ruimte__node_list', ['Bash']],
    ['other', 'mcp_ruimte_node_list', ['mcp_ruimte_node_list', 'Bash']]
] as const) {
    test(`an MCP call agy names mcp_ruimte_node_list, from a launch that passed "${server}", ${server === 'ruimte' ? 'is that tool and runs without a card' : 'is no tool of it and asks'}`, async () => {
        const run = replay(mcpTurnFrames, AGY_TOOLS, { mcpServers: [{ name: server, url: 'http://127.0.0.1:50000/mcp', allowTools: true }] });
        const starting = run.backend.start();
        await run.player.playTo(FIRST_MCP_PROMPT);
        await starting;
        run.backend.sendTurn(turn('tools'));

        for (let asked = 0; asked < asks.length; asked++) {
            await run.player.playTo(FIRST_MCP_ANSWER);
            run.backend.respondApproval(approvals(run.events)[asked]?.requestId ?? '', 'allow');
        }

        await run.player.playTo(FIRST_MCP_ANSWER);
        const calls = run.events.flatMap((event) => (event.type === 'tool.started' ? [event] : []));

        expect(approvals(run.events).map((approval) => approval.toolName)).toEqual([...asks]);
        expect(calls[0]?.name).toBe(named);
        expect(run.events.at(-1)).toMatchObject({ type: 'turn.done', promptId: 'prompt-tools', state: 'done' });

        if (server === 'ruimte') {
            // agy's own `toolSummary` is no argument of the tool.
            expect(calls[0]?.input).toEqual({});
        }

        await run.backend.dispose();
    });
}

test('a daemon command still running when its prompt ends is background work until it ends, and its stop sends session/cancel', async () => {
    const run = replay(cancelFrames, AGY_TOOLS, { runtimeMode: 'full-access' }, AGY_HANDSHAKE);
    await run.backend.start();
    run.backend.sendTurn(turn('daemon'));
    await run.player.playTo(DAEMON_STARTED - 1);
    run.backend.stopTask?.('call_15227589526489405582');
    await run.player.playTo(DAEMON_STARTED);
    const background = run.events.filter((event) => event.type === 'background.started' || event.type === 'background.ended' || event.type === 'stop.refused');

    expect(background.map((event) => event.type)).toEqual(['stop.refused', 'background.started']);
    expect(background[1]).toEqual({
        type: 'background.started',
        taskId: 'call_15227589526489405582',
        ref: 'call_15227589526489405582',
        monitor: false,
        description: null
    });
    expect(run.events.indexOf(background[1]!)).toBeLessThan(run.events.findIndex((event) => event.type === 'turn.done'));

    run.backend.stopTask?.('call_15227589526489405582');
    await run.player.playTo(DAEMON_STOPPED);

    expect(run.methods().at(-1)).toBe('session/cancel');
    expect(run.events.slice(-2)).toMatchObject([
        { type: 'tool.done', ref: 'call_15227589526489405582', state: 'error' },
        { type: 'background.ended', taskId: 'call_15227589526489405582' }
    ]);

    await run.backend.dispose();
});

test('a subagent agy starts is an ordinary tool row that completes once it is spawned, and the prompt stays open until the subagent ends', async () => {
    const frames = agySubagent.frames as AcpTimedFrame[];
    const run = replay(frames, AGY_TOOLS, { runtimeMode: 'full-access' }, AGY_HANDSHAKE);
    await run.backend.start();
    run.backend.sendTurn(turn('subagent'));
    await run.player.playTo(at(frames, isPromptAnswer) - 1);
    const work = run.events.filter(
        (event) => event.type.startsWith('tool.') || event.type.startsWith('task.') || event.type.startsWith('background.') || event.type === 'turn.done'
    );

    expect(work.map((event) => [event.type, 'name' in event ? event.name : 'state' in event ? event.state : null])).toEqual([
        ['tool.started', 'invoke_subagent'],
        ['tool.done', 'done']
    ]);

    await run.player.playTo(at(frames, isPromptAnswer));

    expect(run.events.at(-1)).toMatchObject({ type: 'turn.done', promptId: 'prompt-subagent', state: 'done' });

    await run.backend.dispose();
});

test('a message steered into a running agy prompt goes as a second session/prompt, and both prompts stay one turn whose usage adds up', async () => {
    const frames = agySteer.frames as AcpTimedFrame[];
    const prompts = frames.filter((entry) => entry.frame.method === 'session/prompt');
    const firstAnswer = frames.find((entry) => isPromptAnswer(entry.frame))!;
    const reports: AcpUsageReport[] = [];
    const run = replay(frames, { ...AGY_TOOLS, steer: 'prompt', onUsage: (report) => reports.push(report) }, { runtimeMode: 'full-access' }, AGY_HANDSHAKE);
    await run.backend.start();
    run.backend.sendTurn(turn('sleep'));
    await run.player.playTo(prompts[1]!.t);
    const steered = run.backend.steerTurn?.(turn('banana'));
    await run.player.playTo(firstAnswer.t);

    expect(await steered).toBe(true);

    await run.player.playTo(frames.at(-1)!.t);

    expect(run.methods().slice(2)).toEqual(['session/prompt', 'session/prompt']);
    // The answer follows text, a usage_update and five seconds of quiet before more text: still one reply.
    expect(timeline(run.events)).toEqual(['text: Waiting for the command to complete.\n\nfinished banana', 'end prompt-sleep done']);
    expect(run.events.filter((event) => event.type === 'tool.done')).toMatchObject([{ ref: 'call_1538731445954763707', state: 'done' }]);
    expect(reports.map((report) => report.output)).toEqual([443, 752]);

    await run.backend.dispose();
});

/*
 * Grok's own wake, in the shape T3 Code's tests give it (`_meta.promptId` of `task-completed-…`); no capture of our own
 * shows one. It sends no end of any kind, so the reply ends on quiet.
 */
function grokWake(update: Frame): Frame {
    return { jsonrpc: '2.0', method: 'session/update', params: { sessionId: 'id-3', update, _meta: { promptId: 'task-completed-bg-1' } } };
}

const WAKE_AT = PROMPT_DONE + 1_000;

const grokWakeFrames: AcpTimedFrame[] = [
    { t: WAKE_AT, dir: 'out', frame: grokWake({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'The build finished.' } }) },
    {
        t: WAKE_AT + 100,
        dir: 'out',
        frame: grokWake({ sessionUpdate: 'tool_call', toolCallId: 'read-1', title: 'Read log', kind: 'read', status: 'in_progress' })
    },
    { t: WAKE_AT + 20_000, dir: 'out', frame: grokWake({ sessionUpdate: 'tool_call_update', toolCallId: 'read-1', status: 'completed' }) }
];

test('a turn Grok opens itself ends once three seconds pass with no update, but not while a call it started runs', async () => {
    const run = replay([...grokLoadFrames(), ...grokWakeFrames], { ...GROK, repliesEndOnQuiet: true }, { resume: 'id-3' });
    const starting = run.backend.start();
    await run.player.playTo(538);
    await starting;
    run.backend.sendTurn(turn('early'));
    await run.player.playTo(WAKE_AT + 19_999);

    expect(timeline(run.events)).toEqual(['text: early', 'end prompt-early done', 'text: The build finished.']);

    await run.player.playTo(WAKE_AT + 22_999);

    expect(timeline(run.events)).toEqual(['text: early', 'end prompt-early done', 'text: The build finished.']);

    await run.player.playTo(WAKE_AT + 23_000);

    expect(timeline(run.events).slice(3)).toEqual(['end wake done']);

    await run.backend.dispose();
});

test('a question a Grok wake asks holds its turn open until a person answers, and the quiet wait starts again after the answer', async () => {
    const asks = {
        jsonrpc: '2.0',
        id: 'ask-1',
        method: '_x.ai/ask_user_question',
        params: {
            sessionId: 'id-3',
            toolCallId: 'call-ask-1',
            mode: 'default',
            questions: [{ question: 'Deploy now?', options: [{ label: 'Yes', description: 'Now' }], multiSelect: false }]
        }
    };
    const frames: AcpTimedFrame[] = [...grokLoadFrames(), grokWakeFrames[0]!, { t: WAKE_AT + 100, dir: 'out', frame: asks }];
    const run = replay(frames, { ...GROK, repliesEndOnQuiet: true }, { resume: 'id-3' });
    const ends = () => run.events.filter((event) => event.type === 'turn.done').length;
    const starting = run.backend.start();
    await run.player.playTo(538);
    await starting;
    run.backend.sendTurn(turn('early'));
    await run.player.playTo(WAKE_AT + 60_000);
    const asked = run.events.find((event) => event.type === 'question.requested');

    expect(ends()).toBe(1);

    run.backend.respondQuestion(asked?.type === 'question.requested' ? asked.requestId : '', { '0': 'Yes' });
    await run.player.playTo(WAKE_AT + 62_999);

    expect(ends()).toBe(1);

    await run.player.playTo(WAKE_AT + 63_000);

    expect(ends()).toBe(2);

    await run.backend.dispose();
});
