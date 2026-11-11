import i18next from 'i18next';
import type { ChatThreadInfo } from '../chat-sink';

/* A command or monitor as a client holds it; a newer host may run a kind this version does not know. */
export type ChatThreadBackgroundTask = NonNullable<ChatThreadInfo['background']>[number];

/* What a person reads for a task: what it does, else the command, else its kind. */
export function backgroundTaskName(task: ChatThreadBackgroundTask): string {
    if (task.description || task.command) {
        return task.description || task.command || '';
    }

    return task.kind === 'shell' || task.kind === 'monitor' ? i18next.t(`agent-chat:activity.${task.kind}`) : i18next.t('agent-chat:activity.other');
}

export function backgroundCounts(tasks: readonly ChatThreadBackgroundTask[]): { shells: number; monitors: number; others: number } {
    const shells = tasks.filter((task) => task.kind === 'shell').length;
    const monitors = tasks.filter((task) => task.kind === 'monitor').length;

    return { shells, monitors, others: tasks.length - shells - monitors };
}
