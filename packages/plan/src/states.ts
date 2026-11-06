import type { PlanStepState } from './protocol.ts';

/* The states a person picks from; active is the agent's word for where it works. */
export const PLAN_PERSON_STATES: readonly PlanStepState[] = ['open', 'done', 'warning', 'info', 'failed', 'skipped', 'blocked'];

/* The outcomes the mark of a test step offers. */
export const PLAN_TEST_OUTCOMES: readonly PlanStepState[] = ['done', 'warning', 'info', 'failed', 'skipped', 'blocked'];

/* A state that is only worth something with a line about what happened, so choosing it asks for a note. */
export function asksForNote(state: PlanStepState): boolean {
    return state === 'failed' || state === 'warning' || state === 'info';
}
