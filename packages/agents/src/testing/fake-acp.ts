/*
 * Network-free ACP agent. Prompt commands exercise permissions, cancels, plans, edits and resumes
 * through the JSON-RPC shapes of the Agent Client Protocol, version 1.
 */
import type { FakeCli } from './fake-cli.ts';

type Frame = Record<string, unknown>;

// The prompts of every session, outside any one process: a real agent keeps them on disk, so a later process loads them too.
const sessionHistory = new Map<string, string[]>();

export interface FakeAcpOptions {
    // Advertises `loadSession`; on by default.
    loadSession?: boolean;
    // Advertises `session/resume`, which a client then prefers over a load.
    resumeSession?: boolean;
    // Answers session requests with "authentication required" until `authenticate` names this method.
    authMethod?: string;
    // The modes the session offers, as `session/set_mode` takes them; empty offers none.
    modes?: readonly string[];
    // Reports models the way agents did before config options: `models` and `session/set_model`.
    legacyModels?: boolean;
    // Advertises and answers `session/close`.
    closeSession?: boolean;
    // The `usage` every `session/prompt` response carries; absent reports none.
    turnUsage?: Record<string, number>;
    // Offers a reasoning effort as the config option `reasoning_effort`, without a category: Low and High, and
    // Extra high on `fake-large`. `reject` refuses every change to it.
    reasoningEffort?: 'accept' | 'reject';
    // Names each model's context window in its `_meta` (`totalContextTokens`): 128000 for `fake-small`, 1000000 for `fake-large`.
    contextWindows?: boolean;
    // The slash commands a new session lists, sent before the answer that names the session.
    commands?: readonly string[];
    // Advertises `promptCapabilities.embeddedContext`, so a prompt may carry files as `resource` blocks.
    embeddedContext?: boolean;
}

export function fakeAcpWith(options: FakeAcpOptions): FakeCli {
    return (io) => {
        const modes = options.modes ?? ['ask', 'edit', 'yolo'];
        let authenticated = options.authMethod === undefined;
        let sessionId = '';
        let mode = modes[0] ?? '';
        let model = 'fake-small';
        let effort = 'low';
        let serverRequestId = 0;
        let callCounter = 0;
        let prompt: { rpcId: number | string; cancelled: boolean } | null = null;
        let permission: { rpcId: number; onAnswer(outcome: Frame): void } | null = null;

        const send = (frame: Frame): void => {
            io.out({ jsonrpc: '2.0', ...frame });
        };

        const respond = (id: unknown, result: unknown): void => {
            send({ id, result });
        };

        const refuse = (id: unknown, code: number, message: string): void => {
            send({ id, error: { code, message } });
        };

        const update = (fields: Frame): void => {
            send({ method: 'session/update', params: { sessionId, update: fields } });
        };

        const say = (text: string): void => {
            const half = Math.ceil(text.length / 2);
            update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: text.slice(0, half) } });
            update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: text.slice(half) } });
        };

        const endTurn = (stopReason: string): void => {
            if (prompt === null) {
                return;
            }

            update({ sessionUpdate: 'usage_update', used: 1200, size: 200000, cost: { amount: 0.01, currency: 'USD' } });
            respond(prompt.rpcId, { stopReason, ...(options.turnUsage === undefined ? {} : { usage: options.turnUsage }) });
            prompt = null;
        };

        const sessionState = (): Frame => {
            const meta = (totalContextTokens: number): Frame => (options.contextWindows ? { _meta: { totalContextTokens } } : {});

            const modelChoices = [
                { value: 'fake-small', name: 'Fake small', ...meta(128000) },
                { value: 'fake-large', name: 'Fake large', ...meta(1000000) }
            ];

            const effortChoices = [
                { value: 'low', name: 'Low', description: 'Answers quickly' },
                { value: 'high', name: 'High' },
                ...(model === 'fake-large' ? [{ value: 'xhigh', name: 'Extra high' }] : [])
            ];

            const effortOption =
                options.reasoningEffort === undefined
                    ? []
                    : [{ id: 'reasoning_effort', name: 'Reasoning effort', type: 'select', currentValue: effort, options: effortChoices }];

            return {
                ...(modes.length === 0 ? {} : { modes: { currentModeId: mode, availableModes: modes.map((id) => ({ id, name: id })) } }),
                ...(options.legacyModels
                    ? { models: { currentModelId: model, availableModels: modelChoices.map(({ value, ...choice }) => ({ modelId: value, ...choice })) } }
                    : {
                          configOptions: [
                              { id: 'model', name: 'Model', type: 'select', category: 'model', currentValue: model, options: modelChoices },
                              ...effortOption
                          ]
                      })
            };
        };

        const askPermission = (toolCall: Frame, onAnswer: (outcome: Frame) => void): void => {
            const rpcId = serverRequestId++;
            permission = { rpcId, onAnswer };

            send({
                id: rpcId,
                method: 'session/request_permission',
                params: {
                    sessionId,
                    toolCall,
                    options: [
                        { optionId: 'once', name: 'Allow once', kind: 'allow_once' },
                        { optionId: 'always', name: 'Always allow', kind: 'allow_always' },
                        { optionId: 'no', name: 'Reject', kind: 'reject_once' }
                    ]
                }
            });
        };

        const handlePrompt = (id: unknown, params: Frame): void => {
            const blocks = Array.isArray(params.prompt) ? (params.prompt as Frame[]) : [];

            const text = blocks
                .filter((block) => block.type === 'text')
                .map((block) => String(block.text))
                .join('\n');

            const images = blocks.filter((block) => block.type === 'image').length;
            const history = sessionHistory.get(sessionId) ?? [];
            sessionHistory.set(sessionId, [...history, text]);
            prompt = { rpcId: id as number | string, cancelled: false };
            const last = text.split('\n\n').at(-1) ?? text;

            if (last === 'history?') {
                say(`prompts before: ${history.length}`);
                endTurn('end_turn');

                return;
            }

            if (last === 'mode?') {
                say(`mode: ${mode}, model: ${model}`);
                endTurn('end_turn');

                return;
            }

            if (last === 'crash') {
                io.exit(1);

                return;
            }

            if (last === 'slow') {
                say('working');

                return;
            }

            if (last === 'plan') {
                update({
                    sessionUpdate: 'plan',
                    entries: [
                        { content: 'Read the code', priority: 'high', status: 'completed' },
                        { content: 'Write the fix', priority: 'medium', status: 'in_progress' }
                    ]
                });

                endTurn('end_turn');

                return;
            }

            if (last === 'refuse' || last === 'max tokens') {
                say('no');
                endTurn(last === 'refuse' ? 'refusal' : 'max_tokens');

                return;
            }

            if (last.startsWith('edit:')) {
                const path = last.slice(5).trim();
                const toolCallId = `call-${++callCounter}`;
                const content = [{ type: 'diff', path, oldText: 'one\ntwo\n', newText: 'one\nthree\n' }];
                update({ sessionUpdate: 'tool_call', toolCallId, title: `Edit ${path}`, kind: 'edit', status: 'pending', locations: [{ path }] });

                askPermission({ toolCallId, title: `Edit ${path}`, kind: 'edit', content }, (outcome) => {
                    const allowed = outcome.outcome === 'selected' && outcome.optionId !== 'no';
                    update({ sessionUpdate: 'tool_call_update', toolCallId, status: allowed ? 'completed' : 'failed', content });
                    endTurn(outcome.outcome === 'cancelled' ? 'cancelled' : 'end_turn');
                });

                return;
            }

            if (last.startsWith('tool:')) {
                const command = last.slice(5).trim();
                const toolCallId = `call-${++callCounter}`;
                update({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'I should run it.' } });
                update({ sessionUpdate: 'tool_call', toolCallId, title: `Run ${command}`, kind: 'execute', status: 'pending', rawInput: { command } });

                askPermission({ toolCallId }, (outcome) => {
                    if (outcome.outcome === 'cancelled') {
                        update({ sessionUpdate: 'tool_call_update', toolCallId, status: 'failed' });
                        endTurn('cancelled');

                        return;
                    }

                    if (outcome.optionId === 'no') {
                        update({
                            sessionUpdate: 'tool_call_update',
                            toolCallId,
                            status: 'failed',
                            content: [{ type: 'content', content: { type: 'text', text: 'rejected' } }]
                        });

                        say('not run');
                        endTurn('end_turn');

                        return;
                    }

                    update({ sessionUpdate: 'tool_call_update', toolCallId, status: 'in_progress' });

                    update({
                        sessionUpdate: 'tool_call_update',
                        toolCallId,
                        status: 'completed',
                        content: [{ type: 'content', content: { type: 'text', text: `ran ${command} (${String(outcome.optionId)})` } }]
                    });

                    say('done');
                    endTurn('end_turn');
                });

                return;
            }

            update({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'Thinking.' } });
            say(`echo: ${text}${images > 0 ? ` (${images} images)` : ''}`);
            endTurn('end_turn');
        };

        const handle = (frame: Frame): void => {
            const id = frame.id;
            const params = (typeof frame.params === 'object' && frame.params !== null ? frame.params : {}) as Frame;

            if (frame.method === undefined) {
                // The client's answer to a permission request.
                if (permission !== null && id === permission.rpcId) {
                    const answered = permission;
                    permission = null;
                    const result = frame.result as { outcome?: Frame } | undefined;
                    answered.onAnswer(result?.outcome ?? { outcome: 'cancelled' });
                }

                return;
            }

            switch (frame.method) {
                case 'initialize':
                    respond(id, {
                        protocolVersion: 1,
                        agentCapabilities: {
                            loadSession: options.loadSession ?? true,
                            promptCapabilities: { image: true, audio: false, embeddedContext: options.embeddedContext === true },
                            sessionCapabilities: { ...(options.resumeSession ? { resume: {} } : {}), ...(options.closeSession ? { close: {} } : {}) }
                        },
                        authMethods: options.authMethod === undefined ? [] : [{ id: options.authMethod, name: 'Sign in' }],
                        agentInfo: { name: 'fake-acp', title: 'Fake ACP', version: '0.0.1' }
                    });

                    return;
                case 'authenticate':
                    authenticated = params.methodId === options.authMethod;
                    respond(id, {});

                    return;
                case 'session/new':
                    if (!authenticated) {
                        refuse(id, -32000, 'Authentication required');

                        return;
                    }

                    sessionId = `fake-session-${Math.random().toString(36).slice(2, 8)}`;
                    sessionHistory.set(sessionId, []);

                    if (options.commands !== undefined) {
                        update({
                            sessionUpdate: 'available_commands_update',
                            availableCommands: options.commands.map((name) => ({ name, description: name }))
                        });
                    }

                    respond(id, { sessionId, ...sessionState() });

                    return;
                case 'session/load':
                case 'session/resume': {
                    const history = sessionHistory.get(String(params.sessionId));

                    if (!authenticated) {
                        refuse(id, -32000, 'Authentication required');

                        return;
                    }

                    if (history === undefined) {
                        refuse(id, -32002, 'Session not found');

                        return;
                    }

                    sessionId = String(params.sessionId);

                    if (frame.method === 'session/load') {
                        for (const earlier of history) {
                            update({ sessionUpdate: 'user_message_chunk', content: { type: 'text', text: earlier } });
                            update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'replayed' } });
                        }
                    }

                    respond(id, sessionState());

                    return;
                }
                case 'session/close':
                    if (!options.closeSession) {
                        refuse(id, -32601, 'Method not found: session/close');

                        return;
                    }

                    sessionHistory.delete(String(params.sessionId));
                    respond(id, {});

                    return;
                case 'session/set_mode':
                    mode = String(params.modeId);
                    respond(id, {});
                    update({ sessionUpdate: 'current_mode_update', currentModeId: mode });

                    return;
                case 'session/set_model':
                    model = String(params.modelId);
                    respond(id, {});

                    return;
                case 'session/set_config_option':
                    if (params.configId === 'model') {
                        model = String(params.value);
                    }

                    if (params.configId === 'reasoning_effort') {
                        if (options.reasoningEffort === 'reject') {
                            refuse(id, -32602, 'Reasoning effort is locked');

                            return;
                        }

                        effort = String(params.value);
                    }

                    respond(id, { configOptions: sessionState().configOptions ?? [] });

                    return;
                case 'session/prompt':
                    handlePrompt(id, params);

                    return;
                case 'session/cancel':
                    if (prompt !== null) {
                        prompt.cancelled = true;

                        if (permission === null) {
                            endTurn('cancelled');
                        }
                    }

                    return;
                default:
                    if (id !== undefined) {
                        refuse(id, -32601, `Method not found: ${String(frame.method)}`);
                    }
            }
        };

        return {
            onLine: (line) => {
                handle(JSON.parse(line) as Frame);
            }
        };
    };
}

export const fakeAcp: FakeCli = fakeAcpWith({});
