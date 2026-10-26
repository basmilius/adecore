import { describe, expect, test } from 'bun:test';
import type { ChatWorkflow, ChatWorkflowAgent } from '@adecore/agent-contracts';
import { workflowAgentPreview, workflowAgentState, workflowAgentTime, workflowCounts, workflowDescription, workflowPhases } from './workflow';

function agent(index: number, patch: Partial<ChatWorkflowAgent> = {}): ChatWorkflowAgent {
    return {
        index,
        label: `agent-${index}`,
        phaseIndex: 1,
        agentId: `a${index}`,
        status: 'running',
        startedAt: 1000,
        durationMs: null,
        lastTool: null,
        ...patch
    };
}

function workflow(agents: ChatWorkflowAgent[]): ChatWorkflow {
    return {
        name: 'write-and-read',
        phases: [
            { index: 1, title: 'Write' },
            { index: 2, title: 'Read' }
        ],
        agents
    };
}

describe('workflowPhases', () => {
    test('every announced phase is there in order with its agents, one of no known phase first and untitled', () => {
        const phases = workflowPhases(workflow([agent(1), agent(2, { phaseIndex: null }), agent(3, { phaseIndex: 9 })]), true);

        expect(phases.map((phase) => [phase.title, phase.agents.map((view) => view.agent.index)])).toEqual([
            [null, [2, 3]],
            ['Write', [1]],
            ['Read', []]
        ]);
    });

    test('an agent the last report had at work stopped with its workflow, and one without a start still waits', () => {
        expect(workflowAgentState(agent(1), true)).toBe('running');
        expect(workflowAgentState(agent(1, { startedAt: null }), true)).toBe('waiting');
        expect(workflowAgentState(agent(1), false)).toBe('stopped');
        expect(workflowAgentState(agent(1, { status: 'done' }), false)).toBe('done');
        expect(workflowPhases(workflow([agent(1)]), false)[0]!.agents[0]!.state).toBe('stopped');
    });
});

describe('workflowAgentTime', () => {
    test('a settled agent says how long it took, and the others what they are doing', () => {
        expect(workflowAgentTime({ agent: agent(1, { status: 'done', durationMs: 5421 }), state: 'done' })).toBe('5s');
        expect(workflowAgentTime({ agent: agent(1, { status: 'failed', durationMs: 2000 }), state: 'failed' })).toBe('2s');
        expect(workflowAgentTime({ agent: agent(1, { status: 'failed' }), state: 'failed' })).toBeNull();
        expect(workflowAgentTime({ agent: agent(1, { startedAt: null }), state: 'waiting' })).toBe('waiting');
        expect(workflowAgentTime({ agent: agent(1), state: 'stopped' })).toBe('stopped');
        expect(workflowAgentTime({ agent: agent(1), state: 'running' })).toBeNull();
    });
});

describe('workflowAgentPreview', () => {
    test('an agent at work shows its last tool, a settled one its answer without the heading marks, and a failed one its error', () => {
        expect(workflowAgentPreview({ agent: agent(1, { lastTool: 'Bash', lastToolSummary: 'bun test' }), state: 'running' })).toEqual({
            tool: 'Bash',
            text: 'bun test'
        });

        expect(workflowAgentPreview({ agent: agent(1, { promptPreview: 'Map the device' }), state: 'running' })).toEqual({
            tool: null,
            text: 'Map the device'
        });

        expect(workflowAgentPreview({ agent: agent(1, { resultPreview: '\n# Catalog\nmore', promptPreview: 'Map' }), state: 'done' })).toEqual({
            tool: null,
            text: 'Catalog'
        });

        expect(workflowAgentPreview({ agent: agent(1, { promptPreview: 'Map' }), state: 'done' })).toEqual({ tool: null, text: 'Map' });
        expect(workflowAgentPreview({ agent: agent(1, { error: 'blocked' }), state: 'failed' })).toEqual({ tool: null, text: 'blocked' });
        expect(workflowAgentPreview({ agent: agent(1), state: 'waiting' })).toEqual({ tool: null, text: null });
    });
});

describe('workflowCounts', () => {
    test('counts every agent once by its state', () => {
        const phases = workflowPhases(workflow([agent(1), agent(2, { status: 'done' }), agent(3, { startedAt: null }), agent(4, { status: 'done' })]), true);
        expect(workflowCounts(phases)).toEqual({ total: 4, running: 1, waiting: 1, stopped: 0, done: 2, failed: 0 });
    });
});

describe('workflowDescription', () => {
    test('reads the description out of the meta literal, quotes and escapes included', () => {
        const script =
            "export const meta = {\n    name: 'build',\n    description: 'Build the \\'home\\' layer',\n    phases: [{ title: 'Map' }]\n}\nconst description = 'not this'";

        expect(workflowDescription({ script })).toBe("Build the 'home' layer");

        expect(
            workflowDescription({ script: 'export const meta = { name: "x", phases: [{ title: "}" }] }\nagent("a", { description: "not this" })' })
        ).toBeNull();

        expect(workflowDescription({ name: 'review' })).toBeNull();
        expect(workflowDescription(null)).toBeNull();
    });
});
