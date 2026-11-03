import type { AgentKind } from '@adecore/agent-contracts';

/* A CLI's mark, drawn in the current text color. */
export interface AgentMark {
    /* Read by a screen reader. */
    title: string;
    /* The `d` of one SVG path; several shapes go in one path. */
    path: string;
    /* `0 0 24 24` when absent. */
    viewBox?: string;
    /* `evenodd` for a path whose holes are subpaths inside its shape; `nonzero` when absent. */
    fillRule?: 'nonzero' | 'evenodd';
}

let hostMarks: Readonly<Partial<Record<AgentKind, AgentMark>>> = {};

/*
 * The marks of the kinds a host adds, and any it draws differently, set once before the first render. Every
 * place the shared UI draws an agent's mark reads them; a kind with none keeps the built-in mark or the robot.
 * A later call replaces the whole set.
 */
export function configureAgentMarks(marks: Readonly<Partial<Record<AgentKind, AgentMark>>>): void {
    hostMarks = { ...marks };
}

export function hostAgentMark(kind: AgentKind): AgentMark | undefined {
    return hostMarks[kind];
}
