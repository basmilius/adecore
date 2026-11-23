import { expect, test } from 'bun:test';
import grokLoad from '../chat/fixtures/grok-1.0.70-load.json';
import { playAcpRecording, type AcpTimedFrame } from '../testing/fake-acp-capture.ts';
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

    const backend = createAcpBackend(spec)({ ...launch, ...overrides, spawn: fake.spawn }, { onEvent: (event) => events.push(event) });

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
