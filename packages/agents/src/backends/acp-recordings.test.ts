import { expect, test } from 'bun:test';
import agyDaemonCancel from '../chat/fixtures/antigravity-1.5.15-daemon-cancel.json';
import agyDaemonWake from '../chat/fixtures/antigravity-1.5.15-daemon-wake.json';
import agyMcpTurn from '../chat/fixtures/antigravity-1.5.15-mcp-turn.json';
import grokLoad from '../chat/fixtures/grok-1.0.70-load.json';
import { playAcpRecording, recordedAnswer, type AcpTimedFrame } from '../testing/fake-acp-capture.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { ManualClock } from '../testing/manual-clock.ts';
import { createAcpBackend, type AcpAgentSpec } from './acp-backend.ts';
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
