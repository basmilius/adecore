/*
 * An ACP agent that answers with the frames a real one sent, recorded in a capture: its `initialize`, its
 * `session/new`, and every update of one prompt before the response. Every prompt gets the same turn. A
 * `{ permission }` entry among the updates is a `session/request_permission` the turn waits on until the
 * client answers it, a `{ request: { method, params } }` entry is any other request of the agent the turn waits on the
 * same way, an `{ update, _meta }` entry is a notification with a `_meta` of its own, and with
 * `titleFromPrompt` a `session_info_update` carries the prompt's own text as its title, as Copilot CLI names a session.
 * With `prompts`, each prompt plays its own script instead, where `{ notification: { method, params } }` is sent as it
 * is, a `held` script leaves its response unsent, and `{ answer: <n> }` sends the response of the nth prompt (from 0).
 */
import type { FakeCli } from './fake-cli.ts';

type Frame = Record<string, unknown>;

export interface AcpPromptScript {
    updates: unknown[];
    held?: boolean;
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
