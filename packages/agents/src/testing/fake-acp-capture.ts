/*
 * An ACP agent that answers with the frames a real one sent, recorded in a capture: its `initialize`, its
 * `session/new`, and every update of one prompt before the response. Every prompt gets the same turn. A
 * `{ permission }` entry among the updates is a `session/request_permission` the turn waits on until the
 * client answers it, a `{ request: { method, params } }` entry is any other request of the agent the turn waits on the
 * same way, an `{ update, _meta }` entry is a notification with a `_meta` of its own, and with
 * `titleFromPrompt` a `session_info_update` carries the prompt's own text as its title, as Copilot CLI names a session.
 */
import type { FakeCli } from './fake-cli.ts';

type Frame = Record<string, unknown>;

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
}

/* `answers` collects the client's answer to every permission request, in order. */
export function fakeAcpCapture(capture: AcpCapture, answers: unknown[] = []): FakeCli {
    return (io) => {
        const send = (frame: Frame): void => {
            io.out({ jsonrpc: '2.0', ...frame });
        };

        const update = (fields: unknown): void => {
            const notification = (fields as Frame).update === undefined ? { update: fields } : (fields as Frame);
            send({ method: 'session/update', params: { sessionId: capture.sessionId, ...notification } });
        };

        let waiting: { rpcId: number; rest: unknown[]; promptId: unknown; text: unknown } | null = null;
        let nextRpcId = 0;

        const play = (updates: unknown[], promptId: unknown, text: unknown): void => {
            for (const [index, fields] of updates.entries()) {
                const permission = (fields as Frame).permission;
                const request = (fields as Frame).request as { method: string; params: unknown } | undefined;

                if (permission !== undefined || request !== undefined) {
                    const rpcId = nextRpcId++;
                    waiting = { rpcId, rest: updates.slice(index + 1), promptId, text };
                    send({ id: rpcId, method: request?.method ?? 'session/request_permission', params: request?.params ?? permission });

                    return;
                }

                const named = capture.titleFromPrompt === true && (fields as Frame).sessionUpdate === 'session_info_update';
                update(named ? { ...(fields as Frame), title: text } : fields);
            }

            send(capture.promptError === undefined ? { id: promptId, result: capture.promptResponse } : { id: promptId, error: capture.promptError });
        };

        return {
            onLine: (line) => {
                const frame = JSON.parse(line) as Frame;
                const id = frame.id;

                switch (frame.method) {
                    case undefined: {
                        const answered = waiting;

                        if (answered !== null && id === answered.rpcId) {
                            waiting = null;
                            answers.push(frame.result ?? frame.error);
                            play(answered.rest, answered.promptId, answered.text);
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
                        play(capture.promptUpdates, id, blocks.find((block) => block.type === 'text')?.text);

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
