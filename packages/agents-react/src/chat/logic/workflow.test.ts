import { describe, expect, test } from 'bun:test';
import type { ChatWorkflow, ChatWorkflowAgent } from '@adecore/agent-contracts';
import {
    liveWorkflowPhase,
    workflowAgentPreview,
    workflowAgentState,
    workflowAgentTime,
    workflowCounts,
    workflowDescription,
    workflowPhases,
    workflowPhaseState,
    workflowPhaseTime
} from './workflow';

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

describe('workflowPhaseState', () => {
    const phase = (agents: ChatWorkflowAgent[], running = true) => workflowPhases(workflow(agents), running).find((view) => view.title === 'Write')!;

    test('a phase is at work while one of its agents is, or while some settled and others wait', () => {
        expect(workflowPhaseState(phase([agent(1), agent(2, { status: 'done' })]))).toEqual({ state: 'running', settled: 1, total: 2 });
        expect(workflowPhaseState(phase([agent(1, { status: 'done' }), agent(2, { startedAt: null })]))).toEqual({ state: 'running', settled: 1, total: 2 });
    });

    test('a phase waits before any of its agents started, also without any', () => {
        expect(workflowPhaseState(phase([agent(1, { startedAt: null })]))).toEqual({ state: 'waiting', settled: 0, total: 1 });
        expect(workflowPhaseState(phase([]))).toEqual({ state: 'waiting', settled: 0, total: 0 });
    });

    test('a settled phase is done when every agent finished, and failed when one failed or stopped with the workflow', () => {
        expect(workflowPhaseState(phase([agent(1, { status: 'done' }), agent(2, { status: 'done' })])).state).toBe('done');
        expect(workflowPhaseState(phase([agent(1, { status: 'done' }), agent(2, { status: 'failed' })])).state).toBe('failed');
        expect(workflowPhaseState(phase([agent(1, { status: 'done' }), agent(2)], false))).toEqual({ state: 'failed', settled: 2, total: 2 });
    });
});

describe('workflowPhaseTime', () => {
    const phase = (agents: ChatWorkflowAgent[], running = true) => workflowPhases(workflow(agents), running).find((view) => view.title === 'Write')!;

    test('runs from the first start to the last end, never the sum of agents that ran beside each other', () => {
        const parallel = phase([
            agent(1, { status: 'done', startedAt: 1000, durationMs: 4000 }),
            agent(2, { status: 'done', startedAt: 2000, durationMs: 5000 })
        ]);
        expect(workflowPhaseTime(parallel)).toEqual({ startedAt: 1000, endedAt: 7000 });
    });

    test('counts on while an agent is at work, and is null before any started', () => {
        expect(workflowPhaseTime(phase([agent(1, { status: 'done', startedAt: 500, durationMs: 100 }), agent(2, { startedAt: 900 })]))).toEqual({
            startedAt: 500,
            endedAt: null
        });
        expect(workflowPhaseTime(phase([agent(1, { startedAt: null })]))).toBeNull();
    });

    test('a phase whose agents stopped without a duration ends where it started', () => {
        expect(workflowPhaseTime(phase([agent(1, { startedAt: 800 })], false))).toEqual({ startedAt: 800, endedAt: 800 });
    });
});

describe('liveWorkflowPhase', () => {
    test('follows the phase with an agent at work, the one that started last when several are', () => {
        const phases = workflowPhases(workflow([agent(1, { phaseIndex: 1, startedAt: 2000 }), agent(2, { phaseIndex: 2, startedAt: 1000 })]), true);
        expect(liveWorkflowPhase(phases, true)).toBe('phase-1');
        const later = workflowPhases(workflow([agent(1, { phaseIndex: 1, startedAt: 1000 }), agent(2, { phaseIndex: 2, startedAt: 2000 })]), true);
        expect(liveWorkflowPhase(later, true)).toBe('phase-2');
    });

    test('before an agent is at work it is the first phase that waits, the untitled one of loose agents included', () => {
        expect(liveWorkflowPhase(workflowPhases(workflow([]), true), true)).toBe('phase-1');
        expect(liveWorkflowPhase(workflowPhases(workflow([agent(1, { status: 'done' })]), true), true)).toBe('phase-2');
        expect(liveWorkflowPhase(workflowPhases(workflow([agent(1, { phaseIndex: null, startedAt: null })]), true), true)).toBe('loose');
    });

    test('nothing is live once the workflow stopped running', () => {
        expect(liveWorkflowPhase(workflowPhases(workflow([agent(1)]), false), false)).toBeNull();
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
