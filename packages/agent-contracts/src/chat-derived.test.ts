import { describe, expect, test } from 'bun:test';
import { activeSubagents, outlineItems, type ChatItem, type ChatSubagentItem } from './chat.ts';

function subagent(id: string, turnId: string | null, status: 'running' | 'done', finishedAt: number | null): ChatSubagentItem {
    return { id, kind: 'subagent', createdAt: 1, turnId, status, finishedAt } as ChatSubagentItem;
}

describe('active subagents', () => {
    test('keeps running siblings, recently finished agents and new rows in thread order', () => {
        const items: ChatItem[] = [
            subagent('old', 'old-turn', 'done', 2),
            subagent('sibling', 'shared-turn', 'done', 3),
            subagent('same-time', null, 'done', 10),
            subagent('recent', null, 'done', 11),
            { id: 'message', kind: 'user', createdAt: 10, turnId: 'new-turn', text: 'Continue' },
            subagent('running', 'shared-turn', 'running', null),
            subagent('new-row', null, 'done', 4)
        ];

        expect(activeSubagents(items).map((item) => item.id)).toEqual(['sibling', 'recent', 'running', 'new-row']);
        expect(activeSubagents(items)[0]).toBe(items[1] as ChatSubagentItem);
    });

    test('shows every subagent before the first person message and none from an empty thread', () => {
        const items = [subagent('finished', null, 'done', 2), subagent('running', null, 'running', null)];
        expect(activeSubagents(items)).toEqual(items);
        expect(activeSubagents([])).toEqual([]);
    });
});

describe('the chat outline', () => {
    test('keeps attachment-only messages and bookmarked replies, cuts text and omits checkpoint payloads', () => {
        const attachments = [{ id: 'attachment', name: 'notes.txt', mime: 'text/plain', size: 12, path: 'notes.txt' }];

        const items = [
            { id: 'user', kind: 'user', createdAt: 1, turnId: 'turn', text: '', attachments },
            { id: 'ordinary-turn', kind: 'turn', createdAt: 2, turnId: 'turn', taskIds: [] },
            { id: 'task-turn', kind: 'turn', createdAt: 3, turnId: 'turn', taskIds: ['task'], checkpointDiff: 'large diff' },
            { id: 'reply', kind: 'assistant', createdAt: 4, turnId: 'turn', text: 'x'.repeat(300), streaming: true },
            { id: 'unmarked', kind: 'assistant', createdAt: 5, turnId: 'turn', text: 'hidden', streaming: false },
            { id: 'message-turn', kind: 'turn', createdAt: 6, turnId: 'turn', messageFrom: ['agent'] }
        ] as ChatItem[];

        const original = structuredClone(items);
        const outline = outlineItems(items, new Set(['reply']));
        expect(outline.map((item) => item.id)).toEqual(['user', 'task-turn', 'reply', 'message-turn']);
        expect(outline[0]).toEqual({ id: 'user', kind: 'user', createdAt: 1, turnId: 'turn', text: '', attachments });
        expect(outline[1]).not.toHaveProperty('checkpointDiff');
        expect(outline[2]).toEqual({ id: 'reply', kind: 'assistant', createdAt: 4, turnId: 'turn', text: 'x'.repeat(280), streaming: false });
        expect(items).toEqual(original);
    });
});
