import { ChatGoalStatusSchema, type ChatGoalAction, type ChatGoalStatus, type ProviderCapabilities } from '@adecore/agent-contracts';
import type { ChatThreadInfo } from '../../chat-sink';

type Goal = NonNullable<ChatThreadInfo['goal']>;

/* Whether this version knows the goal's state, so it can word it and say what may be done to it. */
export function knownGoalStatus(goal: Goal): goal is Goal & { status: ChatGoalStatus } {
    return (ChatGoalStatusSchema.options as readonly string[]).includes(goal.status);
}

interface GoalView {
    goal: Goal;
    // What a person may do to it from the row; empty where the CLI or the host offers nothing.
    actions: ChatGoalAction[];
}

/*
 * The row above the composer while the chat has a goal. A CLI with calls for goals pauses, resumes and
 * clears it at any time; one that only reads `/goal` clears it with a turn of its own, so only between
 * turns, and a goal it already met clears itself.
 */
export function goalView(info: Pick<ChatThreadInfo, 'goal' | 'activeTurnId'>, goals: ProviderCapabilities['goals'], canAct: boolean): GoalView | null {
    const goal = info.goal;

    if (goal === undefined) {
        return null;
    }

    if (!canAct || goals === undefined) {
        return { goal, actions: [] };
    }

    if (goals === 'command') {
        return { goal, actions: goal.status === 'complete' || info.activeTurnId !== null ? [] : ['clear'] };
    }

    const actions: ChatGoalAction[] = [];

    // A state of a newer host may mean either, so only a clear is offered for it.
    if (goal.status === 'active') {
        actions.push('pause');
    } else if (knownGoalStatus(goal) && goal.status !== 'complete') {
        actions.push('resume');
    }

    actions.push('clear');

    return { goal, actions };
}
