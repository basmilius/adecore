import i18next from 'i18next';
import type { ChatSubagentStatus, ChatWorkflow, ChatWorkflowAgent } from '@adecore/agent-contracts';
import { formatElapsedShort } from '@adecore/ui/format';

/* `waiting` has not started yet; `stopped` was still at work by the last report when the workflow ended. */
export type WorkflowAgentState = ChatSubagentStatus | 'waiting' | 'stopped';

export interface WorkflowAgentView {
    agent: ChatWorkflowAgent;
    state: WorkflowAgentState;
}

export interface WorkflowPhaseView {
    key: string;
    /* The phase's own title; null for agents outside any phase the script announced. */
    title: string | null;
    agents: WorkflowAgentView[];
}

export function workflowAgentState(agent: ChatWorkflowAgent, workflowRunning: boolean): WorkflowAgentState {
    if (agent.status !== 'running') {
        return agent.status;
    }

    if (!workflowRunning) {
        return 'stopped';
    }

    return agent.startedAt === null ? 'waiting' : 'running';
}

/*
 * The phases in the order the script announced them, each with the agents it started in it. A phase
 * announced ahead of its agents is there without any, and agents of no known phase come first, untitled.
 */
export function workflowPhases(workflow: ChatWorkflow, workflowRunning: boolean): WorkflowPhaseView[] {
    const known = new Map(workflow.phases.map((phase) => [phase.index, phase]));
    const loose: WorkflowAgentView[] = [];
    const byPhase = new Map<number, WorkflowAgentView[]>();

    for (const agent of workflow.agents) {
        const view = { agent, state: workflowAgentState(agent, workflowRunning) };

        if (agent.phaseIndex === null || !known.has(agent.phaseIndex)) {
            loose.push(view);

            continue;
        }

        byPhase.set(agent.phaseIndex, [...(byPhase.get(agent.phaseIndex) ?? []), view]);
    }

    const phases = workflow.phases.map((phase) => ({ key: `phase-${phase.index}`, title: phase.title, agents: byPhase.get(phase.index) ?? [] }));

    return loose.length > 0 ? [{ key: 'loose', title: null, agents: loose }, ...phases] : phases;
}

/* What the line of an agent that is not at work says about its time; one at work counts on by itself. */
export function workflowAgentTime(view: WorkflowAgentView): string | null {
    switch (view.state) {
        case 'running':
            return null;
        case 'waiting':
            return i18next.t('agent-chat:rows.workflow.waiting');
        case 'stopped':
            return i18next.t('agent-chat:rows.workflow.stopped');
        case 'done':
        case 'failed':
            return view.agent.durationMs === null ? null : formatElapsedShort(view.agent.durationMs);
    }
}

export interface WorkflowAgentPreview {
    /* The tool an agent at work last called, drawn apart from what it was called on. */
    tool: string | null;
    text: string | null;
}

/* The CLI's previews start with a markdown heading as often as not, which says nothing on one line. */
function firstLine(text: string | undefined): string | null {
    return (
        text
            ?.split('\n')
            .map((part) => part.replace(/^#+\s*/, '').trim())
            .find((part) => part !== '') ?? null
    );
}

/* The second line of an agent: what it does while at work, what it answered once it stopped, what it was asked before. */
export function workflowAgentPreview(view: WorkflowAgentView): WorkflowAgentPreview {
    const { agent } = view;

    switch (view.state) {
        case 'running':
            return agent.lastTool === null
                ? { tool: null, text: firstLine(agent.promptPreview) }
                : { tool: agent.lastTool, text: firstLine(agent.lastToolSummary) };
        case 'waiting':
            return { tool: null, text: firstLine(agent.promptPreview) };
        case 'failed':
            return { tool: null, text: firstLine(agent.error) ?? firstLine(agent.resultPreview) };
        case 'done':
        case 'stopped':
            return { tool: null, text: firstLine(agent.resultPreview) ?? firstLine(agent.promptPreview) };
    }
}

export type WorkflowCounts = Record<WorkflowAgentState, number> & { total: number };

export function workflowCounts(phases: WorkflowPhaseView[]): WorkflowCounts {
    const counts: WorkflowCounts = { total: 0, running: 0, waiting: 0, stopped: 0, done: 0, failed: 0 };

    for (const view of phases.flatMap((phase) => phase.agents)) {
        counts.total += 1;
        counts[view.state] += 1;
    }

    return counts;
}

/* `running` while an agent of it is at work, `waiting` before any started, and once none can move again `failed` when one did not finish. */
export type WorkflowPhaseStateKind = 'running' | 'waiting' | 'done' | 'failed';

export interface WorkflowPhaseState {
    state: WorkflowPhaseStateKind;
    /* The agents of the phase that are no longer at work or waiting, of all it started so far. */
    settled: number;
    total: number;
}

/* A phase between two of its agents, some settled and some still waiting, is still at work. */
export function workflowPhaseState(phase: WorkflowPhaseView): WorkflowPhaseState {
    const total = phase.agents.length;
    const waiting = phase.agents.filter((view) => view.state === 'waiting').length;
    const running = phase.agents.filter((view) => view.state === 'running').length;
    const settled = total - waiting - running;

    if (running > 0 || (waiting > 0 && settled > 0)) {
        return { state: 'running', settled, total };
    }

    if (settled === 0) {
        return { state: 'waiting', settled, total };
    }

    return { state: phase.agents.every((view) => view.state === 'done') ? 'done' : 'failed', settled, total };
}

export interface WorkflowPhaseTime {
    startedAt: number;
    /* Null while an agent of it is still at work, so the time counts on from `startedAt`. */
    endedAt: number | null;
}

/*
 * How long the phase's agents were at work, from the first start to the last known end. Agents of a
 * phase run beside each other, so this is never the sum of their times. Null before any started.
 */
export function workflowPhaseTime(phase: WorkflowPhaseView): WorkflowPhaseTime | null {
    const started = phase.agents.flatMap((view) => (view.agent.startedAt === null ? [] : [view.agent.startedAt]));

    if (started.length === 0) {
        return null;
    }

    const startedAt = Math.min(...started);

    if (phase.agents.some((view) => view.state === 'running')) {
        return { startedAt, endedAt: null };
    }

    const ends = phase.agents.flatMap(({ agent }) => (agent.startedAt !== null && agent.durationMs !== null ? [agent.startedAt + agent.durationMs] : []));

    return { startedAt, endedAt: Math.max(startedAt, ...ends) };
}

/*
 * The phase a view beside the thread keeps open by itself: the one with an agent at work, the one whose
 * agent started last when several are, and before any is at work the first that still waits. Null once
 * the workflow stopped running, since then nothing is live.
 */
export function liveWorkflowPhase(phases: WorkflowPhaseView[], workflowRunning: boolean): string | null {
    if (!workflowRunning) {
        return null;
    }

    let live: { key: string; startedAt: number } | null = null;

    for (const phase of phases) {
        for (const view of phase.agents) {
            if (view.state === 'running' && (live === null || (view.agent.startedAt ?? 0) >= live.startedAt)) {
                live = { key: phase.key, startedAt: view.agent.startedAt ?? 0 };
            }
        }
    }

    return live?.key ?? phases.find((phase) => workflowPhaseState(phase).state === 'waiting')?.key ?? null;
}

const META_START = /export\s+const\s+meta\s*=\s*\{/;
const DESCRIPTION = /\bdescription\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/;

/* The literal from its opening brace to the one that closes it, skipping braces inside strings. */
function metaLiteral(script: string): string | null {
    const start = META_START.exec(script);

    if (start === null) {
        return null;
    }

    const from = start.index + start[0].length - 1;
    let depth = 0;
    let quote: string | null = null;

    for (let i = from; i < script.length; i++) {
        const char = script[i]!;

        if (quote !== null) {
            if (char === '\\') {
                i++;
            } else if (char === quote) {
                quote = null;
            }

            continue;
        }

        if (char === "'" || char === '"' || char === '`') {
            quote = char;
        } else if (char === '{') {
            depth++;
        } else if (char === '}' && --depth === 0) {
            return script.slice(from, i + 1);
        }
    }

    return null;
}

/* The script's `meta` is a pure literal by the CLI's own rule, so its description reads without running anything. A saved workflow called by name has no script here. */
export function workflowDescription(input: unknown): string | null {
    const script = typeof input === 'object' && input !== null && 'script' in input ? input.script : undefined;
    const meta = typeof script === 'string' ? metaLiteral(script) : null;

    return (meta === null ? undefined : DESCRIPTION.exec(meta)?.[2]?.replace(/\\(.)/g, '$1').trim()) || null;
}
