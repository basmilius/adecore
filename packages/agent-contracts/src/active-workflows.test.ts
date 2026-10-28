import { describe, expect, test } from 'bun:test';
import { activeWorkflows, type ChatItem, type ChatWorkflow, type ChatWorkflowAgent } from './chat.ts';

function user(id: string, createdAt: number): ChatItem {
    return { id, kind: 'user', text: 'Go', createdAt, turnId: null };
}

function call(id: string, state: 'running' | 'done' | 'error', workflow?: Partial<ChatWorkflow>): ChatItem {
    return {
        id,
        kind: 'tool',
        createdAt: 0,
        turnId: null,
        toolUseId: id,
        name: 'Workflow',
        input: {},
        output: null,
        state,
        parentToolUseId: null,
        ...(workflow === undefined ? {} : { workflow: { name: id, phases: [], agents: [], ...workflow } })
    };
}

function agent(startedAt: number | null, durationMs: number | null): ChatWorkflowAgent {
    return { index: 0, label: 'a', phaseIndex: null, agentId: 'a', status: 'done', startedAt, durationMs, lastTool: null };
}

const ids = (items: readonly ChatItem[]) => activeWorkflows(items).map((item) => item.id);

describe('activeWorkflows', () => {
    test('a running workflow counts wherever it is, and one after the last message counts whatever its state', () => {
        expect(ids([call('running', 'running', {}), user('u', 10), call('after', 'error', {})])).toEqual(['running', 'after']);
    });

    test('a workflow that ended before the last message is history, one that ended after it is not', () => {
        expect(ids([call('before', 'done', { finishedAt: 5 }), call('since', 'done', { finishedAt: 20 }), user('u', 10)])).toEqual(['since']);
    });

    test('without a noted end the last end of an agent decides, and else the last report', () => {
        const items = [
            call('agents-before', 'done', { agents: [agent(1, 2), agent(3, 4)] }),
            call('agents-since', 'done', { agents: [agent(1, 2), agent(8, 4)] }),
            call('report-since', 'done', { agents: [agent(null, null)], lastProgressAt: 11 }),
            call('nothing', 'done', {}),
            user('u', 10)
        ];

        expect(ids(items)).toEqual(['agents-since', 'report-since']);
    });

    test('only a Workflow call that reported what it runs counts', () => {
        const other: ChatItem = { ...(call('bash', 'running', {}) as Extract<ChatItem, { kind: 'tool' }>), name: 'Bash' };

        expect(ids([call('unreported', 'running'), other])).toEqual([]);
    });

    test('without a message every workflow counts', () => {
        expect(ids([call('one', 'done', { finishedAt: 1 })])).toEqual(['one']);
    });
});
