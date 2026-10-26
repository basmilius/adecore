import { describe, expect, test } from 'bun:test';
import { SUGGESTED_TITLE_LIMIT } from '@adecore/agent-contracts';
import { ModelCatalog } from '../providers/catalog.ts';
import {
    AcpProtocol,
    acpStopWords,
    autoAllows,
    parseInitialize,
    parseSessionInfo,
    promptUsageOf,
    resolveAcpMode,
    runtimeModeOf,
    thoughtLevelOf,
    toolRow,
    unifiedDiff,
    type AcpModeMap
} from './acp-protocol.ts';
import type { BackendEvent } from './backend.ts';
import turnCapture from './fixtures/acp-v1-turn.json';
import { ThreadProjector } from './projector.ts';
import { ChatThread } from './thread.ts';

const MODES: AcpModeMap = { supervised: ['default'], 'auto-accept-edits': ['accept-edits'], 'full-access': ['bypass'] };

const catalog = new ModelCatalog({
    defaultModel: 'example-fast',
    profiles: { standard: { options: [], contextWindowTokens: {} } },
    models: [{ slug: 'example-fast', name: 'Example Fast', profile: 'standard' }]
});

/* Every event the captured turn maps to, with the permission request answered as the capture says. */
function replay(protocol: AcpProtocol): BackendEvent[] {
    const events: BackendEvent[] = [];

    for (const frame of turnCapture.frames) {
        if (frame.method === 'session/request_permission') {
            const { id, response } = frame as unknown as { id: number; response: { decision: 'allow'; result: unknown } };
            const permission = protocol.permission(id, turnCapture.sessionId, frame.params);
            events.push(...(permission?.events ?? []));
            expect(protocol.answer(permission!.requestId, response.decision)).toMatchObject({ rpcId: id, result: response.result });

            continue;
        }

        events.push(...protocol.update(turnCapture.sessionId, frame.params));
    }

    events.push(...protocol.finish(turnCapture.promptResponse.result, 'prompt-1'));

    return events;
}

describe('AcpProtocol', () => {
    test('reads what initialize and session/new advertise, skipping entries that do not parse', () => {
        const capabilities = parseInitialize(turnCapture.initialize.result);

        expect(capabilities).toEqual({
            protocolVersion: 1,
            loadSession: true,
            resumeSession: false,
            additionalDirectories: true,
            closeSession: false,
            images: true,
            embeddedContext: true,
            authMethods: ['api-key'],
            agent: { name: 'example-agent', title: 'Example Agent', version: '1.4.0' }
        });

        const info = parseSessionInfo(turnCapture.sessionNew.result, 'sess_7f2a', capabilities.agent);

        expect(info.models).toEqual({
            current: 'example-fast',
            configId: 'model',
            models: [
                { id: 'example-fast', name: 'Example Fast', description: null, contextWindow: null },
                { id: 'example-deep', name: 'Example Deep', description: null, contextWindow: null }
            ]
        });
        expect(info.modes).toEqual({
            current: 'default',
            configId: null,
            modes: [
                { id: 'default', name: 'Ask before changes' },
                { id: 'accept-edits', name: 'Accept edits' },
                { id: 'plan', name: 'Plan' }
            ]
        });
        expect(info.thoughtLevel).toEqual({
            configId: 'reasoning',
            current: 'medium',
            choices: [
                { id: 'low', name: 'Low', description: null },
                { id: 'medium', name: 'Medium', description: null },
                { id: 'high', name: 'High', description: null }
            ]
        });
    });

    test('takes a reasoning effort without a category by its id, and reads it from a response that carries the options', () => {
        const options = [
            {
                id: 'reasoning_effort',
                name: 'Reasoning effort',
                type: 'select',
                currentValue: 'high',
                options: [{ value: 'high', name: 'High', description: 'Thinks longer' }]
            }
        ];

        expect(parseSessionInfo({ sessionId: 's', configOptions: options }, 's', null).thoughtLevel).toEqual({
            configId: 'reasoning_effort',
            current: 'high',
            choices: [{ id: 'high', name: 'High', description: 'Thinks longer' }]
        });
        expect(thoughtLevelOf({ configOptions: options })?.current).toBe('high');
        expect(thoughtLevelOf({ configOptions: [] })).toBeNull();
        expect(thoughtLevelOf({})).toBeUndefined();
    });

    test('takes models from the older models field when no config option has them', () => {
        const info = parseSessionInfo(
            { sessionId: 's', models: { currentModelId: 'a', availableModels: [{ modelId: 'a', name: 'A', description: 'First' }, { name: 'no id' }] } },
            's',
            null
        );

        expect(info.models).toEqual({ current: 'a', configId: null, models: [{ id: 'a', name: 'A', description: 'First', contextWindow: null }] });
        expect(info.modes).toBeNull();
    });

    test('reads the context window an agent names in a model meta, and only a positive whole number', () => {
        const meta = (totalContextTokens: unknown) => ({ _meta: { totalContextTokens } });

        const legacy = parseSessionInfo(
            {
                sessionId: 's',
                models: {
                    currentModelId: 'a',
                    availableModels: [
                        { modelId: 'a', name: 'A', ...meta(256000) },
                        { modelId: 'b', name: 'B', ...meta(0) },
                        { modelId: 'c', name: 'C', ...meta('256000') },
                        { modelId: 'd', name: 'D' }
                    ]
                }
            },
            's',
            null
        );

        expect(legacy.models?.models.map((model) => model.contextWindow)).toEqual([256000, null, null, null]);

        const option = parseSessionInfo(
            {
                sessionId: 's',
                configOptions: [
                    { id: 'model', name: 'Model', type: 'select', category: 'model', currentValue: 'a', options: [{ value: 'a', name: 'A', ...meta(128000) }] }
                ]
            },
            's',
            null
        );

        expect(option.models?.models[0]?.contextWindow).toBe(128000);
    });

    test('maps a captured turn onto backend events', () => {
        const events = replay(new AcpProtocol(1, MODES, acpStopWords('Example'), true));

        expect(events).toEqual([
            { type: 'session', agentSessionId: null, model: null, slashCommands: ['review', 'init'] },
            { type: 'thinking.delta', ref: 'thought-1', text: 'The test fails on ' },
            { type: 'thinking.delta', ref: 'thought-1', text: 'an off-by-one.' },
            { type: 'thinking.done', ref: 'thought-1', text: 'The test fails on an off-by-one.' },
            { type: 'text.delta', ref: 'message-msg_1', text: 'Let me run ' },
            { type: 'text.delta', ref: 'message-msg_1', text: 'the tests.' },
            { type: 'text.done', ref: 'message-msg_1', text: 'Let me run the tests.' },
            {
                type: 'tool.started',
                ref: 'call_001',
                name: 'Bash',
                input: { command: 'bun test', timeout: 120, description: 'Run the test suite' },
                parentRef: null
            },
            {
                type: 'approval.requested',
                requestId: 'acp-1-0',
                ref: 'call_001',
                toolName: 'Bash',
                input: { command: 'bun test', timeout: 120, description: 'Run the test suite' },
                description: 'Run the test suite',
                canAllowAlways: true
            },
            { type: 'tool.done', ref: 'call_001', output: '1 fail\nexpected 3, received 4', state: 'error' },
            {
                type: 'tool.started',
                ref: 'plan-2',
                name: 'TodoWrite',
                input: {
                    todos: [
                        { content: 'Find the off-by-one', status: 'completed', activeForm: 'Find the off-by-one', priority: 'high' },
                        { content: 'Fix the loop bound', status: 'in_progress', activeForm: 'Fix the loop bound', priority: 'high' },
                        { content: 'Run the tests again', status: 'pending', activeForm: 'Run the tests again', priority: 'medium' }
                    ]
                },
                parentRef: null
            },
            { type: 'tool.done', ref: 'plan-2', output: null, state: 'done' },
            {
                type: 'tool.started',
                ref: 'call_002',
                name: 'Change',
                input: { description: 'Edit src/range.ts', path: '/work/demo/src/range.ts' },
                parentRef: null
            },
            {
                type: 'tool.started',
                ref: 'call_002',
                name: 'Edit',
                input: {
                    file_path: '/work/demo/src/range.ts',
                    old_string: 'for (let i = 0; i <= end; i++) {\n',
                    new_string: 'for (let i = 0; i < end; i++) {\n',
                    description: 'Edit src/range.ts'
                },
                parentRef: null
            },
            { type: 'tool.done', ref: 'call_002', output: null, state: 'done' },
            { type: 'permissions', permissionMode: 'accept-edits', effectiveRuntimeMode: 'auto-accept-edits' },
            { type: 'text.delta', ref: 'message-msg_2', text: 'Fixed the bound.' },
            { type: 'usage', contextTokens: 48210, contextWindow: 200000, costUsd: 0.0421 },
            { type: 'title', title: 'Fix the range off-by-one' },
            { type: 'text.done', ref: 'message-msg_2', text: 'Fixed the bound.' },
            { type: 'turn.done', promptId: 'prompt-1', costUsd: 0.0421, state: 'done' }
        ]);
    });

    test('a captured turn projects into a thread a person reads', () => {
        const thread = new ChatThread({
            chatId: 'probe',
            provider: 'example',
            cwd: '/work/demo',
            agentSessionId: 'sess_7f2a',
            model: null,
            selection: catalog.normalize(undefined),
            runtimeMode: 'supervised',
            running: true,
            status: 'running',
            activeTurnId: 'turn-1',
            slashCommands: [],
            usage: { contextTokens: 0, contextWindow: null, costUsd: 0, turns: 0 },
            createdAt: 1
        });

        thread.upsert({ id: 'turn-1', kind: 'turn', createdAt: 1, turnId: 'turn-1', state: 'running', promptItemId: null } as never);
        const projector = new ThreadProjector(thread, { providerName: 'Example' });

        for (const event of replay(new AcpProtocol(1, MODES, acpStopWords('Example')))) {
            projector.project(1, event);
        }

        const kinds = thread.list().map((item) => (item.kind === 'tool' ? `tool:${item.name}:${item.state}` : item.kind));
        expect(kinds).toEqual(['turn', 'thinking', 'assistant', 'tool:Bash:error', 'approval', 'tool:TodoWrite:done', 'tool:Edit:done', 'assistant']);
        // The approval stays open: answering it is the session's, which this test leaves out.
        expect(thread.info).toMatchObject({
            status: 'needs-you',
            activeTurnId: null,
            slashCommands: ['review', 'init'],
            permissionMode: 'accept-edits',
            usage: { contextTokens: 48210, contextWindow: 200000, costUsd: 0.0421, turns: 1 }
        });
    });

    test('takes a session title as a client can show it, and leaves out one that only repeats the prompt', () => {
        const protocol = new AcpProtocol(1, MODES, acpStopWords('Example'), true);

        const titled = (title: unknown) => protocol.update('s', { sessionId: 's', update: { sessionUpdate: 'session_info_update', title } });

        const prompt = `You work in a workspace of projects.\n\n${'Read every file of it and say what it holds. '.repeat(4)}`;
        protocol.prompted(prompt);
        expect(titled(prompt)).toEqual([]);
        expect(titled('You work in a workspace')).toEqual([]);
        expect(titled('  Workspace\noverview  ')).toEqual([{ type: 'title', title: 'Workspace overview' }]);
        const [long] = titled('A name '.repeat(20));
        expect(long?.type === 'title' ? long.title.length : Infinity).toBeLessThanOrEqual(SUGGESTED_TITLE_LIMIT);
        expect(titled('   ')).toEqual([]);
        expect(titled(42)).toEqual([]);
    });

    test('takes no session title unless asked, so the host names the chat', () => {
        const protocol = new AcpProtocol(1, MODES, acpStopWords('Example'));
        expect(protocol.update('s', { sessionId: 's', update: { sessionUpdate: 'session_info_update', title: 'Workspace overview' } })).toEqual([]);
    });

    test('a stop reason other than the end of the turn says why', () => {
        const words = acpStopWords('Example');

        const finish = (stopReason: string, cancelled = false) => new AcpProtocol(1, MODES, words).finish({ stopReason }, undefined, cancelled);

        expect(finish('end_turn', true)).toEqual([{ type: 'turn.done', costUsd: 0, state: 'aborted' }]);
        // Only a cancel the client sent stops the turn; an agent that cancels by itself has ended it.
        expect(finish('cancelled')).toEqual([{ type: 'turn.done', costUsd: 0, state: 'done' }]);
        expect(finish('refusal')).toEqual([{ type: 'turn.done', costUsd: 0, state: 'error', error: words.refusal }]);
        expect(finish('max_tokens')).toEqual([
            { type: 'note', level: 'warning', text: words.maxTokens },
            { type: 'turn.done', costUsd: 0, state: 'done' }
        ]);
        expect(finish('max_turn_requests')[0]).toEqual({ type: 'note', level: 'warning', text: words.maxTurnRequests });
        expect(finish('a_future_reason')).toEqual([{ type: 'turn.done', costUsd: 0, state: 'done' }]);
    });

    test('after a refusal, a message that only starts like the refusal line still reaches the thread', () => {
        const protocol = new AcpProtocol(1, MODES, acpStopWords('Example'));

        const permission = protocol.permission(7, 's', {
            sessionId: 's',
            toolCall: { toolCallId: 'c', title: 'Write a.txt', kind: 'edit', content: [{ type: 'diff', path: 'a.txt', newText: 'hi' }] },
            options: [{ optionId: 'no', name: 'Deny', kind: 'reject_once' }]
        })!;

        expect(protocol.answer(permission.requestId, 'deny')?.events).toEqual([
            { type: 'tool.started', ref: 'c', name: 'Change', input: { description: 'Write a.txt' }, parentRef: null }
        ]);

        const chunk = (text: string) =>
            protocol.update('s', { sessionId: 's', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } } });

        expect(chunk('Info: ')).toEqual([]);
        expect(chunk('the file stays as it was.')).toEqual([{ type: 'text.delta', ref: 'message-1', text: 'Info: the file stays as it was.' }]);
        expect(protocol.finish({ stopReason: 'end_turn' }, undefined)[0]).toEqual({
            type: 'text.done',
            ref: 'message-1',
            text: 'Info: the file stays as it was.'
        });
    });

    test('reads the command of a call from the field the agent names it by, for a host to judge', () => {
        const protocol = new AcpProtocol(1, MODES, acpStopWords('Example'));

        const permission = protocol.permission(7, 's', {
            sessionId: 's',
            toolCall: { toolCallId: 'c', title: 'ruimte-context list', kind: 'execute', rawInput: { CommandLine: 'ruimte-context list', Cwd: '/project' } },
            options: [{ optionId: 'once', name: 'Allow', kind: 'allow_once' }]
        })!;

        expect(permission.request.commands).toEqual(['ruimte-context list']);
        expect(permission.events.find((event) => event.type === 'approval.requested')).toMatchObject({ input: { command: 'ruimte-context list' } });
    });

    test('answers a permission with an option the agent offered, never a wider one', () => {
        const ask = (options: Array<{ optionId: string; kind: string }>) => {
            const protocol = new AcpProtocol(1, MODES, acpStopWords('Example'));

            const permission = protocol.permission(7, 's', {
                sessionId: 's',
                toolCall: { toolCallId: 'c', title: 'Do it', kind: 'execute' },
                options: options.map((option) => ({ ...option, name: option.optionId }))
            })!;

            return (decision: 'allow' | 'allow-always' | 'deny') => protocol.answer(permission.requestId, decision)?.result;
        };

        const full = [
            { optionId: 'once', kind: 'allow_once' },
            { optionId: 'always', kind: 'allow_always' },
            { optionId: 'no', kind: 'reject_once' }
        ];

        expect(ask(full)('allow')).toEqual({ outcome: { outcome: 'selected', optionId: 'once' } });
        expect(ask(full)('allow-always')).toEqual({ outcome: { outcome: 'selected', optionId: 'always' } });
        expect(ask(full)('deny')).toEqual({ outcome: { outcome: 'selected', optionId: 'no' } });

        const noAlways = [
            { optionId: 'once', kind: 'allow_once' },
            { optionId: 'never', kind: 'reject_always' }
        ];

        expect(ask(noAlways)('allow-always')).toEqual({ outcome: { outcome: 'selected', optionId: 'once' } });
        expect(ask(noAlways)('deny')).toEqual({ outcome: { outcome: 'selected', optionId: 'never' } });
        expect(ask([{ optionId: 'once', kind: 'allow_once' }])('deny')).toEqual({ outcome: { outcome: 'cancelled' } });
    });

    test('a cancel answers every open permission request as cancelled, once', () => {
        const protocol = new AcpProtocol(2, MODES, acpStopWords('Example'));
        const params = { sessionId: 's', toolCall: { toolCallId: 'c' }, options: [{ optionId: 'once', name: 'Once', kind: 'allow_once' }] };
        protocol.permission(1, 's', params);
        protocol.permission('two', 's', params);

        expect(protocol.cancelRequests()).toEqual([
            { requestId: 'acp-2-1', rpcId: 1, result: { outcome: { outcome: 'cancelled' } } },
            { requestId: 'acp-2-two', rpcId: 'two', result: { outcome: { outcome: 'cancelled' } } }
        ]);
        expect(protocol.cancelRequests()).toEqual([]);
        expect(protocol.answer('acp-2-1', 'allow')).toBeNull();
    });

    test('refuses a permission request of another session or without options', () => {
        const protocol = new AcpProtocol(1, MODES, acpStopWords('Example'));

        expect(
            protocol.permission(1, 's', {
                sessionId: 'other',
                toolCall: { toolCallId: 'c' },
                options: [{ optionId: 'once', name: 'Allow', kind: 'allow_once' }]
            })
        ).toBeNull();
        expect(protocol.permission(1, 's', { sessionId: 's', toolCall: { toolCallId: 'c' } })).toBeNull();
    });

    test('chunks without a message id are one message until a tool call cuts it', () => {
        const protocol = new AcpProtocol(1, MODES, acpStopWords('Example'));

        const chunk = (text: string) => ({ sessionId: 's', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } } });

        const events = [
            ...protocol.update('s', chunk('a')),
            ...protocol.update('s', chunk('b')),
            ...protocol.update('s', {
                sessionId: 's',
                update: { sessionUpdate: 'tool_call', toolCallId: 't', title: 'Look', kind: 'think', status: 'completed' }
            }),
            ...protocol.update('s', chunk('c')),
            ...protocol.abort(undefined, null)
        ];

        expect(events.filter((event) => event.type === 'text.done')).toEqual([
            { type: 'text.done', ref: 'message-1', text: 'ab' },
            { type: 'text.done', ref: 'message-2', text: 'c' }
        ]);
        expect(events.at(-1)).toEqual({ type: 'turn.done', costUsd: 0, state: 'aborted' });
    });
});

describe('modes', () => {
    test('a runtime mode the agent has no mode for falls to a narrower one, never a wider one', () => {
        expect(resolveAcpMode('full-access', MODES, ['default', 'accept-edits', 'bypass'])).toEqual({ modeId: 'bypass', runtimeMode: 'full-access' });
        expect(resolveAcpMode('auto', MODES, ['default', 'accept-edits', 'bypass'])).toEqual({ modeId: 'accept-edits', runtimeMode: 'auto-accept-edits' });
        expect(resolveAcpMode('full-access', MODES, ['default'])).toEqual({ modeId: 'default', runtimeMode: 'supervised' });
        expect(resolveAcpMode('supervised', MODES, ['accept-edits', 'bypass'])).toBeNull();
        expect(runtimeModeOf('bypass', MODES)).toBe('full-access');
        expect(runtimeModeOf('plan', MODES)).toBeNull();
    });

    test('the backend answers on its own only what the runtime mode allows', () => {
        expect(autoAllows('supervised', 'read')).toBe(false);
        expect(autoAllows('auto-accept-edits', 'edit')).toBe(true);
        expect(autoAllows('auto-accept-edits', 'execute')).toBe(false);
        expect(autoAllows('auto', 'fetch')).toBe(true);
        expect(autoAllows('auto', 'delete')).toBe(false);
        expect(autoAllows('full-access', null)).toBe(true);
    });
});

describe('tool rows', () => {
    test('diffs over several files become unified changes', () => {
        const row = toolRow({
            title: 'Rename',
            name: null,
            kind: 'edit',
            rawInput: undefined,
            locations: [],
            diffs: [
                { type: 'diff', path: 'a.ts', oldText: 'one\ntwo\nthree\n', newText: 'one\n2\nthree\n' },
                { type: 'diff', path: 'b.ts', oldText: null, newText: 'new\n' }
            ]
        });

        expect(row).toEqual({
            name: 'ApplyPatch',
            input: { summary: 'a.ts, b.ts', description: 'Rename' },
            changes: [
                { path: 'a.ts', kind: 'update', diff: '@@ -2,1 +2,1 @@\n-two\n+2\n' },
                { path: 'b.ts', kind: 'add', diff: '@@ -0,0 +1,1 @@\n+new\n' }
            ]
        });
    });

    test('a kind the thread has no word for keeps the agent name of the tool', () => {
        expect(toolRow({ title: 'Ask the docs', name: 'docs_lookup', kind: 'other', rawInput: { topic: 'acp' }, locations: [], diffs: [] })).toEqual({
            name: 'docs_lookup',
            input: { description: 'Ask the docs', topic: 'acp' }
        });
        expect(toolRow({ title: 'Remove a.ts', name: null, kind: 'delete', rawInput: undefined, locations: ['a.ts'], diffs: [] }).name).toBe('Delete');
        expect(toolRow({ title: 'Fetch', name: null, kind: 'fetch', rawInput: { url: 'https://example.com' }, locations: [], diffs: [] }).name).toBe(
            'WebFetch'
        );
    });

    test('a unified diff of identical texts is nothing', () => {
        expect(unifiedDiff('same\n', 'same\n')).toBeNull();
        expect(unifiedDiff('a\nb\n', 'a\n')).toBe('@@ -2,1 +1,0 @@\n-b\n');
    });
});

describe('the usage of a prompt response', () => {
    test('keeps the input apart from the cache when the kinds add up to the total', () => {
        const usage = { totalTokens: 1600, inputTokens: 100, outputTokens: 400, thoughtTokens: 150, cachedReadTokens: 1000, cachedWriteTokens: 100 };
        expect(promptUsageOf({ stopReason: 'end_turn', usage })).toEqual({ input: 100, cacheRead: 1000, cacheWrite: 100, output: 400, reasoning: 150 });
    });

    test('takes the cache out of an input that holds it', () => {
        const usage = { totalTokens: 1500, inputTokens: 1100, outputTokens: 400, cachedReadTokens: 1000, cachedWriteTokens: null };
        expect(promptUsageOf({ stopReason: 'end_turn', usage })).toEqual({ input: 100, cacheRead: 1000, cacheWrite: 0, output: 400, reasoning: 0 });
    });

    test('is null where the agent reports none, or nothing it can count', () => {
        expect(promptUsageOf({ stopReason: 'end_turn' })).toBeNull();
        expect(promptUsageOf({ stopReason: 'end_turn', usage: null })).toBeNull();
        expect(promptUsageOf({ stopReason: 'end_turn', usage: { inputTokens: 10 } })).toBeNull();
        expect(promptUsageOf({ stopReason: 'end_turn', usage: { totalTokens: 0, inputTokens: 0, outputTokens: 0 } })).toBeNull();
    });
});

describe('a count of the context outside the protocol', () => {
    const chunk = (text: string, totalTokens?: number) => ({
        sessionId: 's',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } },
        ...(totalTokens === undefined ? {} : { _meta: { totalTokens } })
    });

    const usageOf = (events: BackendEvent[]) => events.filter((event) => event.type === 'usage');

    test('fills the meter from `_meta.totalTokens` of an update and of the response, once per change', () => {
        const protocol = new AcpProtocol(1, MODES, acpStopWords('Example'));
        expect(usageOf(protocol.update('s', chunk('o', 1457)))).toEqual([{ type: 'usage', contextTokens: 1457 }]);
        expect(usageOf(protocol.update('s', chunk('k', 1457)))).toEqual([]);
        expect(usageOf(protocol.update('s', chunk('!')))).toEqual([]);
        expect(usageOf(protocol.finish({ stopReason: 'end_turn', _meta: { totalTokens: 21939 } }, 'prompt-1'))).toEqual([
            { type: 'usage', contextTokens: 21939 }
        ]);
    });

    test('is never read once the agent sent a standard usage update', () => {
        const protocol = new AcpProtocol(1, MODES, acpStopWords('Example'));
        protocol.update('s', { sessionId: 's', update: { sessionUpdate: 'usage_update', used: 300, size: 1000 } });
        expect(usageOf(protocol.update('s', chunk('o', 1457)))).toEqual([]);
        expect(usageOf(protocol.finish({ stopReason: 'end_turn', _meta: { totalTokens: 21939 } }, 'prompt-1'))).toEqual([]);
    });

    test("takes a model's window from the older models field where the config option names none", () => {
        const info = parseSessionInfo(
            {
                configOptions: [
                    { id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: 'big', options: [{ value: 'big', name: 'Big' }] }
                ],
                models: { currentModelId: 'big', availableModels: [{ modelId: 'big', name: 'Big', _meta: { totalContextTokens: 256000 } }] }
            },
            's',
            null
        );

        expect(info.models?.models).toEqual([{ id: 'big', name: 'Big', description: null, contextWindow: 256000 }]);
    });
});
