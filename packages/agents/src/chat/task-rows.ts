import { HOST_TASK_ORIGIN, taskRowId, type ChatItem, type ChatSubagentItem, type Task } from '@adecore/agent-contracts';
import type { ChatSession } from './chat-session.ts';

/* The cancelled note's reason for a task that was cancelled without a result. */
export const DEFAULT_TASK_REMOVED_REASON = 'it was removed';

/*
 * The subagent row of a task in the thread of the chat that gave it, written from the task alone so
 * writing it twice changes nothing. A new row joins the turn that is running, which is the turn that
 * ran the tool; a cancelled task gets one note saying why its row failed.
 */
export function taskRowItems(session: Pick<ChatSession, 'thread' | 'info'>, task: Task, removedReason: string = DEFAULT_TASK_REMOVED_REASON): ChatItem[] {
    const id = taskRowId(task.id);
    const existing = session.thread.get(id);
    const row: ChatSubagentItem = {
        id,
        kind: 'subagent',
        createdAt: task.createdAt,
        turnId: existing?.turnId ?? session.info.activeTurnId,
        toolUseId: id,
        description: task.title,
        subagentType: null,
        prompt: task.prompt,
        background: true,
        status: task.status === 'open' ? 'running' : task.status === 'done' ? 'done' : 'failed',
        startedAt: task.createdAt,
        finishedAt: task.settledAt,
        summary: null,
        result: task.result?.text ?? null,
        usage: null,
        lastTool: null,
        itemsTruncated: false,
        origin: HOST_TASK_ORIGIN,
        childId: task.childId
    };
    const noteId = `${id}-cancelled`;

    if (task.status !== 'cancelled' || session.thread.get(noteId) !== undefined) {
        return [row];
    }

    return [
        row,
        {
            id: noteId,
            kind: 'note',
            createdAt: task.settledAt ?? task.createdAt,
            turnId: null,
            level: 'warning',
            text: `The task "${task.title}" was cancelled: ${task.result?.text ?? removedReason}`
        }
    ];
}

/* The ids of the task rows a clear hid, as a record keeps them beside the thread. */
export function clearedTasksExtras(ids: ReadonlySet<string> | undefined): Record<string, unknown> {
    return ids === undefined || ids.size === 0 ? {} : { clearedTaskIds: [...ids] };
}

export function clearedTaskIdsOf(extras: Readonly<Record<string, unknown>>): string[] {
    return Array.isArray(extras.clearedTaskIds) ? extras.clearedTaskIds.filter((id): id is string => typeof id === 'string') : [];
}
