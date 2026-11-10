import type { ChatBackgroundTask, ChatInfo } from '@adecore/agent-contracts';
import { formatElapsedShort, formatMoment } from '@adecore/ui/format';
import i18next from 'i18next';

/* An open task the chat delegated: whether its child waits out a limit, and that child's info where the client has it. */
export interface WaitingChild {
    paused?: { until?: number };
    child?: Pick<ChatInfo, 'status' | 'requests'>;
}

/* What a chat has that it may be waiting on, as every client already holds it. */
export interface WaitingOnInput {
    children?: readonly WaitingChild[];
    background?: readonly ChatBackgroundTask[];
    /* Background subagents and workflows of the CLI's own, counted where the thread is loaded. */
    subagents?: number;
    workflows?: number;
    /* `ChatInfo.delegating`, for a client that has only the info and so no counts. */
    delegating?: boolean;
    /* The status line of the plan the chat works on. */
    planStatus?: string;
}

export type WaitingOn =
    | { kind: 'needs-you'; count: number }
    | { kind: 'paused'; until?: number }
    | { kind: 'command'; task: ChatBackgroundTask }
    | { kind: 'background'; subagents: number; workflows: number }
    | { kind: 'plan'; text: string };

/*
 * The one thing a chat waits on, most pressing first: a child that needs the person, a child paused
 * until a time, the oldest command or monitor in the background, background subagents and workflows,
 * and the plan's status line. Null when it waits on none of them.
 */
export function waitingOnOf(input: WaitingOnInput): WaitingOn | null {
    const children = input.children ?? [];
    const needsYou = children.filter((entry) => entry.child?.status === 'needs-you' || (entry.child?.requests?.length ?? 0) > 0).length;

    if (needsYou > 0) {
        return { kind: 'needs-you', count: needsYou };
    }

    const paused = children.filter((entry) => entry.paused !== undefined);

    if (paused.length > 0) {
        const times = paused.flatMap((entry) => (entry.paused?.until === undefined ? [] : [entry.paused.until]));

        return times.length === 0 ? { kind: 'paused' } : { kind: 'paused', until: Math.min(...times) };
    }

    const oldest = (input.background ?? []).reduce<ChatBackgroundTask | null>(
        (found, task) => (found === null || task.startedAt < found.startedAt ? task : found),
        null
    );

    if (oldest !== null) {
        return { kind: 'command', task: oldest };
    }

    const subagents = input.subagents ?? 0;
    const workflows = input.workflows ?? 0;

    if (subagents > 0 || workflows > 0 || input.delegating === true) {
        return { kind: 'background', subagents, workflows };
    }

    const status = input.planStatus?.trim();

    return status ? { kind: 'plan', text: status } : null;
}

/* The line a person reads for it, in the words of the `agent-chat` namespace; `now` ages a command. */
export function waitingOnLabel(waiting: WaitingOn, now: number): string {
    const t = (key: string, options?: Record<string, unknown>): string => i18next.t(`agent-chat:${key}`, options ?? {});

    switch (waiting.kind) {
        case 'needs-you':
            return t('waitingOn.needsYou', { count: waiting.count });
        case 'paused':
            return waiting.until === undefined ? t('waitingOn.paused') : t('waitingOn.pausedUntil', { time: formatMoment(waiting.until, now) });
        case 'command':
            return t('waitingOn.command', {
                command: waiting.task.description || waiting.task.command || t(`activity.${waiting.task.kind}`),
                age: formatElapsedShort(Math.max(0, now - waiting.task.startedAt))
            });
        case 'background':
            if (waiting.subagents === 0 && waiting.workflows === 0) {
                return t('waitingOn.background');
            }

            return [
                waiting.subagents > 0 && t('waitingOn.subagents', { count: waiting.subagents }),
                waiting.workflows > 0 && t('waitingOn.workflows', { count: waiting.workflows })
            ]
                .filter(Boolean)
                .join(' · ');
        case 'plan':
            return waiting.text;
    }
}
