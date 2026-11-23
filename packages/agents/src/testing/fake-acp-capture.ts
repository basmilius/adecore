/*
 * An ACP agent that answers with the frames a real one sent, recorded in a capture: its `initialize`, its
 * `session/new`, and every update of one prompt before the response. Every prompt gets the same turn. A
 * `{ permission }` entry among the updates is a `session/request_permission` the turn waits on until the
 * client answers it, a `{ request: { method, params } }` entry is any other request of the agent the turn waits on the
 * same way, an `{ update, _meta }` entry is a notification with a `_meta` of its own, and with
 * `titleFromPrompt` a `session_info_update` carries the prompt's own text as its title, as Copilot CLI names a session.
 * With `prompts`, each prompt plays its own script instead, where `{ notification: { method, params } }` is sent as it
 * is, a `held` script leaves its response unsent, and `{ answer: <n> }` sends the response of the nth prompt (from 0).
 * An `{ awaits: { method, result } }` entry holds the prompt until the client sends that request, which it answers with
 * `result` before it plays on.
 */
import type { FakeCli, FakeIo } from './fake-cli.ts';
import type { ManualClock } from './manual-clock.ts';

type Frame = Record<string, unknown>;

export interface AcpPromptScript {
    updates: unknown[];
    held?: boolean;
}

/* A session as `tee-cli.ts` recorded it, `dir` being `in` for what went to the agent. */
export interface AcpRecording {
    frames: ReadonlyArray<{ dir: string; frame: Frame }>;
}

/* A recorded frame, `t` milliseconds into the recording. */
export interface AcpTimedFrame {
    t: number;
    dir: string;
    frame: Frame;
}

export interface AcpRecordingPlayer {
    cli: FakeCli;
    // Every frame the client sent, in order.
    received: Frame[];
    // Moves the clock to `at` milliseconds into the recording, delivering every frame due on the way.
    playTo(at: number): Promise<void>;
}

async function settle(): Promise<void> {
    for (let i = 0; i < 8; i++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
}

/*
 * An ACP agent that sends the frames of a recording on a manual clock. A frame goes out at its time, and not before the
 * client sent every frame it sent before that one in the recording: a request or notification matched by its method,
 * an answer by its id. A reply goes out under the id the client gave its request. A request the recording does not hold
 * is answered with `answers[method]`, or `{}`.
 */
export function playAcpRecording(frames: readonly AcpTimedFrame[], clock: ManualClock, answers: Readonly<Record<string, unknown>> = {}): AcpRecordingPlayer {
    const startedAt = clock.now();
    const queue = [...frames];
    const seen = new Set<AcpTimedFrame>();
    const ids = new Map<unknown, unknown>();
    const received: Frame[] = [];
    let io: FakeIo | null = null;

    const pump = (): void => {
        for (;;) {
            const [next] = queue;

            if (io === null || next === undefined || (next.dir === 'in' && !seen.has(next)) || (next.dir !== 'in' && startedAt + next.t > clock.now())) {
                return;
            }

            queue.shift();

            if (next.dir !== 'in') {
                const frame = next.frame;
                io.out(frame.method === undefined && ids.has(frame.id) ? { ...frame, id: ids.get(frame.id) } : frame);
            }
        }
    };

    const cli: FakeCli = (processIo) => {
        io = processIo;

        return {
            onLine: (line) => {
                const frame = JSON.parse(line) as Frame;
                received.push(frame);

                const recorded = queue.find(
                    (entry) =>
                        entry.dir === 'in' &&
                        !seen.has(entry) &&
                        (frame.method === undefined ? entry.frame.method === undefined && entry.frame.id === frame.id : entry.frame.method === frame.method)
                );

                if (recorded !== undefined) {
                    seen.add(recorded);

                    if (frame.method !== undefined && frame.id !== undefined) {
                        ids.set(recorded.frame.id, frame.id);
                    }

                    pump();

                    return;
                }

                if (frame.method !== undefined && frame.id !== undefined) {
                    processIo.out({ jsonrpc: '2.0', id: frame.id, result: answers[String(frame.method)] ?? {} });
                }
            }
        };
    };

    const playTo = async (at: number): Promise<void> => {
        for (;;) {
            await settle();
            pump();
            await settle();
            const [next] = queue;
            const due = next === undefined || next.dir === 'in' || next.t > at ? at : next.t;

            if (startedAt + due <= clock.now()) {
                return;
            }

            clock.advance(startedAt + due - clock.now());
        }
    };

    return { cli, received, playTo };
}

/* The agent's answer to the first request of `method` in a recording. */
export function recordedAnswer(frames: readonly AcpTimedFrame[], method: string): unknown {
    const request = frames.find((entry) => entry.dir === 'in' && entry.frame.method === method);

    return frames.find((entry) => entry.dir !== 'in' && entry.frame.method === undefined && entry.frame.id === request?.frame.id)?.frame.result;
}

export interface AcpCapture {
    sessionId: string;
    initialize: unknown;
    sessionNew: unknown;
    // The `available_commands_update` the agent sends before it answers `session/new`.
    commands: unknown[];
    setConfigOption: unknown;
    promptUpdates: unknown[];
    promptResponse: unknown;
    // The JSON-RPC error a prompt fails with instead of the response, when set.
    promptError?: unknown;
    titleFromPrompt?: boolean;
    // The script of each prompt in turn; a prompt past the list plays `promptUpdates`.
    prompts?: AcpPromptScript[];
}

/* `answers` collects the client's answer to every permission request, in order, and `received` every request and notification of the client. */
export function fakeAcpCapture(capture: AcpCapture, answers: unknown[] = [], received: Frame[] = []): FakeCli {
    return (io) => {
        const send = (frame: Frame): void => {
            io.out({ jsonrpc: '2.0', ...frame });
        };

        const update = (fields: unknown): void => {
            const notification = (fields as Frame).update === undefined ? { update: fields } : (fields as Frame);
            send({ method: 'session/update', params: { sessionId: capture.sessionId, ...notification } });
        };

        let waiting: { rpcId: number; rest: unknown[]; promptId: unknown; text: unknown; held: boolean } | null = null;
        let awaiting: { method: string; result: unknown; rest: unknown[]; promptId: unknown; text: unknown; held: boolean } | null = null;
        let nextRpcId = 0;
        const promptIds: unknown[] = [];

        const respond = (promptId: unknown): void => {
            send(capture.promptError === undefined ? { id: promptId, result: capture.promptResponse } : { id: promptId, error: capture.promptError });
        };

        const play = (updates: unknown[], promptId: unknown, text: unknown, held: boolean): void => {
            for (const [index, fields] of updates.entries()) {
                const permission = (fields as Frame).permission;
                const request = (fields as Frame).request as { method: string; params: unknown } | undefined;
                const notification = (fields as Frame).notification as { method: string; params: unknown } | undefined;
                const answer = (fields as Frame).answer;
                const awaits = (fields as Frame).awaits as { method: string; result: unknown } | undefined;

                if (awaits !== undefined) {
                    awaiting = { ...awaits, rest: updates.slice(index + 1), promptId, text, held };

                    return;
                }

                if (permission !== undefined || request !== undefined) {
                    const rpcId = nextRpcId++;
                    waiting = { rpcId, rest: updates.slice(index + 1), promptId, text, held };
                    send({ id: rpcId, method: request?.method ?? 'session/request_permission', params: request?.params ?? permission });

                    return;
                }

                if (notification !== undefined) {
                    send({ method: notification.method, params: notification.params });

                    continue;
                }

                if (typeof answer === 'number') {
                    respond(promptIds[answer]);

                    continue;
                }

                const named = capture.titleFromPrompt === true && (fields as Frame).sessionUpdate === 'session_info_update';
                update(named ? { ...(fields as Frame), title: text } : fields);
            }

            if (!held) {
                respond(promptId);
            }
        };

        return {
            onLine: (line) => {
                const frame = JSON.parse(line) as Frame;
                const id = frame.id;

                if (frame.method !== undefined) {
                    received.push(frame);
                }

                const awaited = awaiting;

                if (awaited !== null && frame.method === awaited.method && id !== undefined) {
                    awaiting = null;
                    send({ id, result: awaited.result });
                    play(awaited.rest, awaited.promptId, awaited.text, awaited.held);

                    return;
                }

                switch (frame.method) {
                    case undefined: {
                        const answered = waiting;

                        if (answered !== null && id === answered.rpcId) {
                            waiting = null;
                            answers.push(frame.result ?? frame.error);
                            play(answered.rest, answered.promptId, answered.text, answered.held);
                        }

                        return;
                    }
                    case 'initialize':
                        send({ id, result: capture.initialize });

                        return;
                    case 'session/new':
                        update({ sessionUpdate: 'available_commands_update', availableCommands: capture.commands });
                        send({ id, result: capture.sessionNew });

                        return;
                    case 'session/set_config_option':
                        send({ id, result: capture.setConfigOption });

                        return;
                    case 'session/set_mode':
                    case 'session/close':
                        send({ id, result: {} });

                        return;
                    case 'session/prompt': {
                        const blocks = Array.isArray((frame.params as Frame | undefined)?.prompt) ? ((frame.params as Frame).prompt as Frame[]) : [];
                        const script = capture.prompts?.[promptIds.length];
                        promptIds.push(id);
                        play(script?.updates ?? capture.promptUpdates, id, blocks.find((block) => block.type === 'text')?.text, script?.held === true);

                        return;
                    }
                    case 'session/cancel':
                        return;
                    default:
                        if (id !== undefined) {
                            send({ id, error: { code: -32601, message: `Method not found: ${String(frame.method)}` } });
                        }
                }
            }
        };
    };
}

/*
 * The capture of a recording with one prompt: the answers to `initialize` and `session/new`, and every frame the agent
 * sent from the prompt to its response. A request the client sent meanwhile becomes an `awaits` entry with the agent's
 * answer. What the agent sent before it answered `session/new` is left out.
 */
export function recordedCapture(recording: AcpRecording): AcpCapture {
    const frames = recording.frames;
    const sentByClient = (entry: { dir: string }): boolean => entry.dir === 'in';
    const answerTo = (id: unknown) => frames.find((entry) => !sentByClient(entry) && entry.frame.method === undefined && entry.frame.id === id)?.frame;
    const requestOf = (method: string) => frames.find((entry) => sentByClient(entry) && entry.frame.method === method)?.frame;
    const promptAt = frames.findIndex((entry) => sentByClient(entry) && entry.frame.method === 'session/prompt');
    const promptId = frames[promptAt]?.frame.id;
    const responseAt = frames.findIndex((entry) => !sentByClient(entry) && entry.frame.method === undefined && entry.frame.id === promptId);
    const sessionNew = answerTo(requestOf('session/new')?.id)?.result as Frame;

    if (promptAt === -1 || responseAt === -1) {
        throw new Error('The recording holds no prompt with its response');
    }

    const updates = frames.slice(promptAt + 1, responseAt).flatMap(({ dir, frame }) => {
        if (dir === 'in') {
            return frame.method === undefined || frame.id === undefined ? [] : [{ awaits: { method: frame.method, result: answerTo(frame.id)?.result } }];
        }

        if (frame.method === undefined) {
            return [];
        }

        if (frame.id !== undefined) {
            throw new Error(`A request of the agent (${String(frame.method)}) in a recording is not played yet`);
        }

        return [frame.method === 'session/update' ? frame.params : { notification: { method: frame.method, params: frame.params } }];
    });

    return {
        sessionId: String(sessionNew.sessionId),
        initialize: answerTo(requestOf('initialize')?.id)?.result,
        sessionNew,
        commands: [],
        setConfigOption: {},
        promptUpdates: updates,
        promptResponse: frames[responseAt]?.frame.result
    };
}
