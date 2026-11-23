import { expect, test } from 'bun:test';
import goalResumeCapture from '../chat/fixtures/codex-0.166.0-goal-resume.json';
import { inProcess, type FakeIo } from '../testing/fake-cli.ts';
import { fakeCodexWith, type FakeCodexOptions } from '../testing/fake-codex.ts';
import { ManualClock } from '../testing/manual-clock.ts';
import { codexProvider } from '../testing/providers.ts';
import type { BackendEvent, BackendLaunch, TurnInput } from './backend.ts';
import { CodexBackend } from './codex-backend.ts';
import { DEFAULT_CODEX_CLIENT } from './codex-transport.ts';

type Frame = { id?: number | string; method?: string; params?: Record<string, unknown> };
type Recorded = { t: number; dir: 'in' | 'out'; frame: Frame };

const launch: BackendLaunch = {
    command: ['codex'],
    cwd: '/tmp',
    env: {},
    selection: codexProvider.catalog.normalize(undefined),
    modelName: 'Codex',
    runtimeMode: 'supervised',
    resume: 'thread-1',
    generation: 1,
    instructions: 'Instructions the thread started with.',
    resumeNote: 'Linked context.'
};

async function resumeAndSend(overrides: Partial<BackendLaunch>, options: FakeCodexOptions = {}): Promise<Frame[]> {
    const requests: Frame[] = [];
    let turnSent: (() => void) | null = null;

    const sent = new Promise<void>((resolve) => {
        turnSent = resolve;
    });

    const fake = inProcess((io) => {
        const program = fakeCodexWith(options)(io);

        return {
            onLine: (line) => {
                const frame = JSON.parse(line) as Frame;

                if (frame.method) {
                    requests.push(frame);
                }

                program.onLine(line);

                if (frame.method === 'turn/start') {
                    turnSent?.();
                }
            }
        };
    });

    const backend = new CodexBackend({ ...launch, ...overrides, spawn: fake.spawn }, { onEvent: () => undefined }, { client: DEFAULT_CODEX_CLIENT });
    await backend.start();
    backend.sendTurn({ text: 'hello', preamble: null, attachments: [], mentions: [], skills: [] });
    await sent;
    await backend.dispose();

    return requests;
}

function firstPrompt(requests: Frame[]): string {
    const input = requests.find((request) => request.method === 'turn/start')?.params?.input as Array<{ text: string }> | undefined;

    return input?.[0]?.text ?? '';
}

test('a resumed thread takes in changed instructions as a developer message, ahead of its next prompt', async () => {
    const requests = await resumeAndSend({ resumeInstructions: 'Instructions as they stand now.' });

    expect(requests.map((request) => request.method)).toEqual([
        'initialize',
        'initialized',
        'thread/resume',
        'thread/inject_items',
        'model/list',
        'thread/goal/get',
        'turn/start'
    ]);
    expect(requests.find((request) => request.method === 'thread/resume')?.params?.developerInstructions).toBeUndefined();
    expect(requests.find((request) => request.method === 'thread/inject_items')?.params).toEqual({
        threadId: 'thread-1',
        items: [{ type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'Instructions as they stand now.' }] }]
    });
    expect(firstPrompt(requests)).toBe('Linked context.\n\nhello');
});

test('a resumed thread that holds its instructions injects nothing', async () => {
    const requests = await resumeAndSend({});
    expect(requests.some((request) => request.method === 'thread/inject_items')).toBe(false);
    expect(firstPrompt(requests)).toBe('Linked context.\n\nhello');
});

test('an app-server without inject_items hears the changed instructions in front of the prompt', async () => {
    const requests = await resumeAndSend({ resumeInstructions: 'Instructions as they stand now.' }, { injectItems: false });
    expect(firstPrompt(requests)).toBe('Instructions as they stand now.\n\nLinked context.\n\nhello');
});

test('a new thread starts with the instructions and injects none', async () => {
    const requests = await resumeAndSend({ resume: null, resumeInstructions: 'Instructions as they stand now.' });
    expect(requests.find((request) => request.method === 'thread/start')?.params?.developerInstructions).toBe('Instructions the thread started with.');
    expect(requests.some((request) => request.method === 'thread/inject_items')).toBe(false);
    expect(firstPrompt(requests)).toBe('hello');
});

const recorded = goalResumeCapture.frames as unknown as Recorded[];
const THREAD = 'codex-thread-1';
const PROMPT: TurnInput = { text: 'hello', promptId: 'prompt-1', preamble: null, attachments: [], mentions: [], skills: [] };

function recordedFrame(method: string): Recorded {
    const entry = recorded.find((candidate) => candidate.dir === 'out' && candidate.frame.method === method);

    if (entry === undefined) {
        throw new Error(`The capture holds no ${method}`);
    }

    return entry;
}

const goalTurnStarted = recordedFrame('turn/started');
const goalTurnCompleted = recordedFrame('turn/completed');
const GOAL_TURN = (goalTurnStarted.frame.params?.turn as { id?: string } | undefined)?.id;
// The handshake's last answer comes 3 ms after Codex opened its turn, the turn's first item seconds later.
const HANDSHAKE_DONE = goalTurnStarted.t + 100;

/* The model list the capture leaves out, and an empty result for any other request it does not hold. */
function answerEmpty(frame: Frame, io: FakeIo): void {
    io.out({ id: frame.id, result: frame.method === 'model/list' ? { data: [] } : {} });
}

/* A person's turn that ends at once, and an interrupt that ends the turn it names. */
function answerTurns(frame: Frame, io: FakeIo): void {
    if (frame.method === 'turn/start') {
        const turn = { id: 'person-turn', items: [], status: 'inProgress', error: null };
        io.out({ id: frame.id, result: { turn } });
        io.out({ method: 'turn/started', params: { threadId: THREAD, turn } });
        io.out({ method: 'turn/completed', params: { threadId: THREAD, turn: { ...turn, status: 'completed' } } });

        return;
    }

    if (frame.method === 'turn/interrupt') {
        io.out({ id: frame.id, result: {} });
        io.out({ method: 'turn/completed', params: { threadId: THREAD, turn: { id: frame.params?.turnId, items: [], status: 'interrupted', error: null } } });

        return;
    }

    answerEmpty(frame, io);
}

async function settle(): Promise<void> {
    for (let i = 0; i < 8; i++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
}

/*
 * A backend resuming the thread of the capture, against its second process up to the end of the goal turn Codex opened
 * itself, on a manual clock. A recorded frame goes out at its time, and a reply also not before the backend asked for
 * it, under the backend's own id.
 */
async function resumeGoal(answer: (frame: Frame, io: FakeIo) => void = answerEmpty) {
    const clock = new ManualClock();
    const startedAt = clock.now();
    const outgoing = recorded.slice(0, recorded.indexOf(goalTurnCompleted) + 1).filter((entry) => entry.dir === 'out');
    const requests = recorded.filter((entry) => entry.dir === 'in' && entry.frame.id !== undefined && entry.frame.method !== undefined);
    const ids = new Map<unknown, unknown>();
    const sent: Array<{ at: number; frame: Frame }> = [];
    const events: BackendEvent[] = [];
    let io: FakeIo | null = null;

    const blocked = (entry: Recorded): boolean => entry.frame.method === undefined && !ids.has(entry.frame.id);

    const pump = (): void => {
        for (;;) {
            const [next] = outgoing;

            if (io === null || next === undefined || blocked(next) || startedAt + next.t > clock.now()) {
                return;
            }

            outgoing.shift();
            io.out(next.frame.method === undefined ? { ...next.frame, id: ids.get(next.frame.id) } : next.frame);
        }
    };

    const fake = inProcess((processIo) => {
        io = processIo;

        return {
            onLine: (line) => {
                const frame = JSON.parse(line) as Frame;
                sent.push({ at: clock.now() - startedAt, frame });

                if (frame.method === undefined || frame.id === undefined) {
                    return;
                }

                const request = requests.find((entry) => entry.frame.method === frame.method);

                if (request === undefined) {
                    answer(frame, processIo);

                    return;
                }

                requests.splice(requests.indexOf(request), 1);
                ids.set(request.frame.id, frame.id);
                pump();
            }
        };
    });

    /* Moves the clock to `at` ms after the process started, delivering every frame due on the way. */
    const playTo = async (at: number): Promise<void> => {
        for (;;) {
            await settle();
            pump();
            await settle();
            const [next] = outgoing;
            const due = next === undefined || blocked(next) || next.t > at ? at : next.t;

            if (startedAt + due <= clock.now()) {
                return;
            }

            clock.advance(startedAt + due - clock.now());
        }
    };

    const backend = new CodexBackend(
        { ...launch, resume: THREAD, resumeInstructions: 'Capture instruction: end every reply with the word marker.', spawn: fake.spawn },
        { onEvent: (event) => events.push(event) },
        { client: DEFAULT_CODEX_CLIENT }
    );

    const starting = backend.start();
    await playTo(HANDSHAKE_DONE);
    await starting;

    return { backend, sent, events, playTo };
}

function sentMethods(sent: Array<{ frame: Frame }>): string[] {
    return sent.flatMap((entry) => (entry.frame.method === undefined ? [] : [entry.frame.method]));
}

test('a goal turn Codex opens itself on resume holds the instructions injected before it and gets nothing of ours', async () => {
    const run = await resumeGoal();
    await run.playTo(goalTurnCompleted.t);
    await run.backend.dispose();
    const goals = run.events.filter((event) => event.type === 'goal');
    const texts = run.events.flatMap((event) => (event.type === 'text.done' ? [event.text] : []));

    expect(sentMethods(run.sent)).toEqual(['initialize', 'initialized', 'thread/resume', 'thread/inject_items', 'model/list', 'thread/goal/get']);
    expect(run.sent.find((entry) => entry.frame.method === 'thread/inject_items')?.at).toBeLessThan(goalTurnStarted.t);
    expect(goals.at(-1)).toMatchObject({ goal: { status: 'active' } });
    expect(texts).toContain('Run 1 of 4 completed successfully. marker');
    expect(run.events.filter((event) => event.type === 'turn.done')).toEqual([{ type: 'turn.done', state: 'done', costUsd: 0, native: { turnId: GOAL_TURN } }]);
});

test('a prompt sent while that goal turn runs waits for it, and its turn ends with its own answer', async () => {
    const run = await resumeGoal(answerTurns);
    run.backend.sendTurn(PROMPT);
    await run.playTo(goalTurnCompleted.t - 1);

    expect(sentMethods(run.sent)).not.toContain('turn/start');

    await run.playTo(goalTurnCompleted.t);
    await run.backend.dispose();
    const starts = run.sent.filter((entry) => entry.frame.method === 'turn/start');

    expect(starts.map((entry) => entry.at)).toEqual([goalTurnCompleted.t]);
    expect(firstPrompt(starts.map((entry) => entry.frame))).toBe('Linked context.\n\nhello');
    expect(run.events.filter((event) => event.type === 'turn.done')).toEqual([
        { type: 'turn.done', promptId: 'prompt-1', state: 'done', costUsd: 0, native: { turnId: 'person-turn' } }
    ]);
});

test('a Stop during that goal turn ends the prompt waiting for it, which never goes out', async () => {
    const run = await resumeGoal(answerTurns);
    run.backend.sendTurn(PROMPT);
    run.backend.interrupt();
    await run.playTo(HANDSHAKE_DONE);
    await run.backend.dispose();

    expect(sentMethods(run.sent)).toContain('turn/interrupt');
    expect(sentMethods(run.sent)).not.toContain('turn/start');
    expect(run.events.filter((event) => event.type === 'turn.done')).toEqual([
        { type: 'turn.done', promptId: 'prompt-1', state: 'aborted', costUsd: 0, native: { turnId: GOAL_TURN } }
    ]);
});
