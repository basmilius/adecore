import { UiFailure } from './budget.ts';

/* A spent budget ends the whole block; every other failure only marks the part it came from. */
export function rethrowBudget(error: unknown): void {
    if (error instanceof UiFailure && error.code === 'budget_exceeded') {
        throw error;
    }
}
