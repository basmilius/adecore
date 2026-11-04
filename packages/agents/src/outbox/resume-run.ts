import { notResumedNote } from '@adecore/agent-contracts';
import { z } from 'zod';
import type { InterruptedRun } from '../chat/chat-core.ts';
import { errorText } from '../error-text.ts';
import type { AnyOutboxEntry } from '../tasks/task-work.ts';
import type { OutboxEntryOf } from './outbox.ts';

export const ResumeRunWorkSchema = z.object({
    kind: z.literal('resume-run'),
    // The target is the chat; the turn it was running and the attempt that takes it up again.
    payload: z.object({ turnId: z.string().min(1), attempt: z.number().int().positive() })
});

export type ResumeRunWork = z.infer<typeof ResumeRunWorkSchema>;
export type ResumeRunEntry = OutboxEntryOf<ResumeRunWork>;

export interface OweResumeDeps {
    /* The project that holds the chat; null for a chat no project holds, which nothing would resume for. */
    projectOf(chatId: string): string | null;
    entries(): readonly AnyOutboxEntry[];
    enqueue(projectId: string, target: string, work: ResumeRunWork): Promise<void>;
}

export interface ResumeRunDeps {
    resumeRun(chatId: string, turnId: string, attempt: number): Promise<void>;
    abandonRun(chatId: string, turnId: string, reason: string): void;
}

function isResumeRun(entry: AnyOutboxEntry): entry is ResumeRunEntry {
    return entry.kind === 'resume-run';
}

/*
 * Owes the resume of a turn the host went down in, once per turn and attempt. Loading the chat again
 * from the handler asks the same question and finds it owed. Only writes to the outbox, so the chat
 * that asks never runs the resume in its own call stack.
 */
export function oweResume(deps: OweResumeDeps) {
    return async (run: InterruptedRun): Promise<boolean> => {
        const projectId = deps.projectOf(run.chatId);

        if (projectId === null) {
            return false;
        }

        const owed = deps
            .entries()
            .some((entry) => isResumeRun(entry) && entry.target === run.chatId && entry.payload.turnId === run.turnId && entry.payload.attempt === run.attempt);

        if (!owed) {
            await deps.enqueue(projectId, run.chatId, { kind: 'resume-run', payload: { turnId: run.turnId, attempt: run.attempt } });
        }

        return true;
    };
}

/* Takes the turn up again; a CLI that will not start throws, and the worker tries again on its retry delays. */
export function resumeRunHandler(deps: Pick<ResumeRunDeps, 'resumeRun'>) {
    return (entry: ResumeRunEntry): Promise<void> => deps.resumeRun(entry.target, entry.payload.turnId, entry.payload.attempt);
}

/* A resume given up on ends its turn as aborted, with the reason in the thread, instead of leaving it running forever. */
export function resumeRunParked(deps: Pick<ResumeRunDeps, 'abandonRun'>) {
    return (entry: AnyOutboxEntry, error: unknown): void => {
        if (isResumeRun(entry)) {
            deps.abandonRun(entry.target, entry.payload.turnId, notResumedNote(errorText(error)));
        }
    };
}
