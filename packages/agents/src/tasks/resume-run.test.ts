import { describe, expect, test } from 'bun:test';
import { notResumedNote } from '@adecore/agent-contracts';
import { oweResume, resumeRunHandler, resumeRunParked, type ResumeRunEntry, type ResumeRunWork } from './resume-run.ts';
import type { AnyOutboxEntry } from './task-work.ts';

const RUN = { chatId: 'chat-1', turnId: 'turn-1', attempt: 2 };

function entryOf(work: ResumeRunWork, target = RUN.chatId): ResumeRunEntry {
    return { ...work, id: `${work.kind}-1`, projectId: 'project-1', target, createdAt: 0, attempts: 0, notBefore: 0 };
}

function outbox(projectOf: (chatId: string) => string | null = () => 'project-1') {
    const entries: AnyOutboxEntry[] = [];
    const owe = oweResume({
        projectOf,
        entries: () => entries,
        enqueue: async (_projectId, target, work) => {
            entries.push(entryOf(work, target));
        }
    });

    return { entries, owe };
}

describe('oweResume', () => {
    test('owes a turn once per attempt, however often the chat asks', async () => {
        const { entries, owe } = outbox();

        expect(await owe(RUN)).toBe(true);
        expect(await owe(RUN)).toBe(true);
        expect(await owe({ ...RUN, attempt: 3 })).toBe(true);

        expect(entries.map((entry) => (entry as ResumeRunEntry).payload)).toEqual([
            { turnId: 'turn-1', attempt: 2 },
            { turnId: 'turn-1', attempt: 3 }
        ]);
    });

    test('owes nothing for a chat no project holds', async () => {
        const { entries, owe } = outbox(() => null);

        expect(await owe(RUN)).toBe(false);
        expect(entries).toEqual([]);
    });
});

describe('the handlers', () => {
    const entry = entryOf({ kind: 'resume-run', payload: { turnId: 'turn-1', attempt: 2 } });

    test('take the turn up again under its attempt', async () => {
        const resumed: unknown[] = [];

        await resumeRunHandler({ resumeRun: async (...args) => void resumed.push(args) })(entry);

        expect(resumed).toEqual([['chat-1', 'turn-1', 2]]);
    });

    test('end a resume given up on with the reason, and leave other work alone', () => {
        const abandoned: unknown[] = [];
        const parked = resumeRunParked({ abandonRun: (...args) => void abandoned.push(args) });

        parked(entry, new Error('claude would not start'));
        parked({ ...entry, kind: 'wake-parent', payload: { taskId: 'task-1' } }, new Error('other'));

        expect(abandoned).toEqual([['chat-1', 'turn-1', notResumedNote('claude would not start')]]);
    });
});
