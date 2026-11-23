import { scheduledWakeupAt } from '@adecore/agent-contracts';
import { formatElapsedShort, formatMoment } from '@adecore/ui/format';
import i18next from 'i18next';
import type { ChatThreadInfo } from '../chat-sink';

/* A command or monitor as a client holds it; a newer host may run a kind this version does not know. */
export type ChatThreadBackgroundTask = NonNullable<ChatThreadInfo['background']>[number];

/* What a person reads for a task: what it does, else the command, else its kind. A wakeup reads as one in their words. */
export function backgroundTaskName(task: ChatThreadBackgroundTask): string {
    if (scheduledWakeupAt(task) !== null) {
        return i18next.t('agent-chat:activity.wakeup');
    }

    if (task.description || task.command) {
        return task.description || task.command || '';
    }

    return task.kind === 'shell' || task.kind === 'monitor' ? i18next.t(`agent-chat:activity.${task.kind}`) : i18next.t('agent-chat:activity.other');
}

/* How long a task has run, or for a wakeup when it fires. */
export function backgroundTaskTime(task: ChatThreadBackgroundTask, now: number): string {
    const wakesAt = scheduledWakeupAt(task);

    return wakesAt === null
        ? formatElapsedShort(Math.max(0, now - task.startedAt))
        : i18next.t('agent-chat:activity.wakesAt', { time: formatMoment(wakesAt, now) });
}

export function backgroundCounts(tasks: readonly ChatThreadBackgroundTask[]): { shells: number; monitors: number; wakeups: number; others: number } {
    const wakeups = tasks.filter((task) => scheduledWakeupAt(task) !== null).length;
    const shells = tasks.filter((task) => task.kind === 'shell' && scheduledWakeupAt(task) === null).length;
    const monitors = tasks.filter((task) => task.kind === 'monitor' && scheduledWakeupAt(task) === null).length;

    return { shells, monitors, wakeups, others: tasks.length - shells - monitors - wakeups };
}
