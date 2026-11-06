import type { SpawnChatProcess } from '../chat-process.ts';

/* A process started for one question about a thread, apart from any chat's own. */
export interface ThreadProcess {
    command: string[];
    cwd: string;
    env: Record<string, string>;
    spawn?: SpawnChatProcess;
}

export interface ThreadItemsParams {
    threadId: string;
    cursor?: string;
    limit: number;
    sortDirection: 'asc' | 'desc';
}

export interface ThreadForkParams {
    threadId: string;
    /* The turn the fork goes on after; null for all of it. */
    at: { turnId: string } | { turns: number } | null;
    /* The thread options the fork runs with: `cwd`, `model` and what the runtime mode says. */
    options: Record<string, unknown>;
}

/* What a CLI that keeps a chat in threads of an app-server can be asked without a chat of its own running. */
export interface ProviderThreads {
    /* A page of a thread's items, asked of a process started for the question. */
    listItems(process: ThreadProcess, params: ThreadItemsParams): Promise<unknown>;
    /* A new thread with the turns of one up to the cut, and its id. */
    fork(process: ThreadProcess, params: ThreadForkParams): Promise<string>;
}
