import { describe, expect, test } from 'bun:test';
import type { ChatItem, ChatWorkflow, ChatWorkflowAgent } from '@adecore/agent-contracts';
import { flyoutWorkflows, workflowPillOf, workflowWordOf, type WorkflowCall } from './workflow-list';

function agent(index: number, status: ChatWorkflowAgent['status']): ChatWorkflowAgent {
    return {
        index,
        label: `a${index}`,
        phaseIndex: null,
        agentId: `a${index}`,
        status,
        startedAt: 1,
        durationMs: status === 'running' ? null : 5,
        lastTool: null
    };
}

function call(id: string, state: 'running' | 'done' | 'error', workflow: Partial<ChatWorkflow> = {}): WorkflowCall {
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
        workflow: { name: `Flow ${id}`, phases: [], agents: [], ...workflow }
    };
}

describe('flyoutWorkflows', () => {
    test('lists the ones from before the page first, and leaves out a call that never reported', () => {
        const unreported = { ...call('quiet', 'running'), workflow: undefined };
        const structure: Record<string, ChatItem> = { old: call('old', 'running'), quiet: unreported, now: call('now', 'running') };

        expect(flyoutWorkflows(['old', 'quiet', 'now', 'gone'], structure).map((item) => item.id)).toEqual(['old', 'now']);
    });
});

describe('workflowWordOf', () => {
    test('reads the state of the call, and a stall of one that still runs', () => {
        expect(workflowWordOf(call('w', 'running'))).toBe('running');
        expect(workflowWordOf(call('w', 'running', { stalledAt: 9 }))).toBe('stalled');
        expect(workflowWordOf(call('w', 'done', { stalledAt: 9 }))).toBe('done');
        expect(workflowWordOf(call('w', 'error'))).toBe('failed');
    });
});

describe('workflowPillOf', () => {
    test('names one workflow with how many of its agents are done', () => {
        const running = call('w', 'running', { agents: [agent(0, 'done'), agent(1, 'running'), agent(2, 'running')] });

        expect(workflowPillOf([running])).toEqual({ word: 'running', label: 'Flow w · 1/3' });
        expect(workflowPillOf([call('w', 'running')])).toEqual({ word: 'running', label: 'Flow w' });
        expect(workflowPillOf([call('w', 'running', { name: null })]).label).toBe('Workflow');
        expect(workflowPillOf([call('w', 'running', { stalledAt: 9 })])).toEqual({ word: 'stalled', label: 'Flow w · no progress' });
        expect(workflowPillOf([call('w', 'error', { agents: [agent(0, 'failed')] })])).toEqual({ word: 'failed', label: 'Flow w · 0/1' });
    });

    test('counts several by the ones still at work, and all of them once none is', () => {
        expect(workflowPillOf([call('a', 'done'), call('b', 'running'), call('c', 'running', { stalledAt: 9 })])).toEqual({
            word: 'stalled',
            label: '2 workflows'
        });
        expect(workflowPillOf([call('a', 'done'), call('b', 'error'), call('c', 'done')])).toEqual({ word: 'failed', label: '3 workflows' });
    });
});
