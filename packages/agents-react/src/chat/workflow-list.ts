import i18next from 'i18next';
import { activeWorkflows, type ChatItem, type ChatToolItem, type ChatWorkflow } from '@adecore/agent-contracts';
import { workflowCounts, workflowPhases } from './logic/workflow';

/* A Workflow call that reported what it runs, which is every one `activeWorkflows` keeps. */
export type WorkflowCall = ChatToolItem & { workflow: ChatWorkflow };

/* `stalled` still runs, but reported nothing for a while. */
export type WorkflowWord = 'running' | 'stalled' | 'done' | 'failed';

export interface WorkflowPill {
    word: WorkflowWord;
    label: string;
}

/* What the workflow pill over the composer lists (`activeWorkflows`); `order` puts the calls from before the page first. */
export function flyoutWorkflows(order: readonly string[], structure: Readonly<Record<string, ChatItem>>): WorkflowCall[] {
    return activeWorkflows(
        order.flatMap((id) => {
            const item = structure[id];

            return item === undefined ? [] : [item];
        })
    ).filter((tool): tool is WorkflowCall => tool.workflow !== undefined);
}

export function workflowWordOf(tool: WorkflowCall): WorkflowWord {
    if (tool.state === 'running') {
        return tool.workflow.stalledAt === undefined ? 'running' : 'stalled';
    }

    return tool.state === 'error' ? 'failed' : 'done';
}

/* What asks for a look first: one that stalled, then one at work, then one that failed. */
const PRESSING: readonly WorkflowWord[] = ['stalled', 'running', 'failed', 'done'];

/*
 * One workflow names itself with how many of its agents are done, or that it stalled. Several are
 * counted like the sub-agents badge: the ones still at work, and all of them once none is.
 */
export function workflowPillOf(calls: readonly WorkflowCall[]): WorkflowPill {
    const words = calls.map(workflowWordOf);
    const word = PRESSING.find((candidate) => words.includes(candidate)) ?? 'done';

    if (calls.length !== 1) {
        const active = words.filter((candidate) => candidate === 'running' || candidate === 'stalled').length;

        return { word, label: i18next.t('agent-chat:activity.workflows', { count: active > 0 ? active : calls.length }) };
    }

    const call = calls[0]!;
    const name = call.workflow.name ?? i18next.t('agent-chat:activity.workflow');

    if (word === 'stalled') {
        return { word, label: i18next.t('agent-chat:activity.workflowStalled', { name }) };
    }

    const counts = workflowCounts(workflowPhases(call.workflow, word === 'running'));

    return {
        word,
        label: counts.total === 0 ? name : i18next.t('agent-chat:activity.workflowProgress', { name, done: counts.done, total: counts.total })
    };
}
