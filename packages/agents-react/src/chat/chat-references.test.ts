import { describe, expect, test } from 'bun:test';
import { referablesOfChats, referenceSuggestions, referenceTokens, type Referable, type Referables } from './chat-references';

const ITEMS: Referable[] = [
    { id: 'view-research', name: 'Research Q3', kind: 'chat', group: 'views' },
    { id: 'view-sketch', name: 'Sketch', kind: 'drawing', group: 'views' },
    { id: 'node-research', name: 'Research', kind: 'note', group: 'canvas' },
    { id: 'node-flow', name: 'Onboarding flow', kind: 'diagram', group: 'canvas' }
];

describe('referenceSuggestions', () => {
    const referables: Referables = { items: ITEMS, chatsOnly: false };

    test('matches the query anywhere in the name, whatever its case, with what stands on this canvas first', () => {
        expect(referenceSuggestions(referables, 'RESEARCH', [], 8).map((item) => item.id)).toEqual(['node-research', 'view-research']);
        expect(referenceSuggestions(referables, 'flow', [], 8).map((item) => item.id)).toEqual(['node-flow']);
    });

    test('leaves out what the chat already picked and stops at the limit', () => {
        expect(referenceSuggestions(referables, 'research', ['node-research'], 8).map((item) => item.id)).toEqual(['view-research']);
        expect(referenceSuggestions(referables, '', [], 1).map((item) => item.id)).toEqual(['node-research']);
    });

    test('offers only chats to a machine that takes no more', () => {
        expect(referenceSuggestions({ items: ITEMS, chatsOnly: true }, '', [], 8).map((item) => item.id)).toEqual(['view-research']);
    });
});

describe('referenceSuggestions over projects', () => {
    test('stops at the limit per project, so a large project keeps no other out of the menu', () => {
        const current = { id: 'project-a', name: 'A', current: true };
        const other = { id: 'project-b', name: 'B' };

        const items: Referable[] = [
            { id: 'a1', name: 'One', kind: 'chat', group: 'views', section: current },
            { id: 'a2', name: 'Two', kind: 'chat', group: 'views', section: current },
            { id: 'b1', name: 'Three', kind: 'chat', group: 'views', section: other }
        ];

        expect(referenceSuggestions({ items, chatsOnly: false }, '', [], 1).map((item) => item.id)).toEqual(['a1', 'b1']);
    });
});

describe('referenceSuggestions over a canvas', () => {
    const items: Referable[] = [
        { id: 'board', name: 'Board', kind: 'canvas', group: 'views' },
        { id: 'runner', name: 'Runner', kind: 'terminal', group: 'views', trail: [{ id: 'board', name: 'Board', kind: 'canvas' }] }
    ];

    test('a node comes with its canvas above it, also one that does not match or is picked', () => {
        expect(referenceSuggestions({ items, chatsOnly: false }, 'run', [], 8).map((item) => item.id)).toEqual(['board', 'runner']);
        expect(referenceSuggestions({ items, chatsOnly: false }, 'run', ['board'], 8).map((item) => item.id)).toEqual(['board', 'runner']);
    });

    test('typing the name of a canvas finds what stands on it', () => {
        expect(referenceSuggestions({ items, chatsOnly: false }, 'boa', [], 8).map((item) => item.id)).toEqual(['board', 'runner']);
    });
});

describe('referablesOfChats', () => {
    test('a host without views offers its chats, and only chats', () => {
        expect(referablesOfChats([{ id: 'chat-a', title: 'Planner' }])).toEqual({
            items: [{ id: 'chat-a', name: 'Planner', kind: 'chat', group: 'views' }],
            chatsOnly: true
        });
    });
});

describe('referenceTokens', () => {
    test('spells a pick by the name it was picked under, else by the name it has now', () => {
        expect(referenceTokens(['view-sketch', 'node-flow'], ITEMS, { 'view-sketch': 'Old sketch' })).toEqual([
            { id: 'view-sketch', name: 'Old sketch' },
            { id: 'node-flow', name: 'Onboarding flow' }
        ]);
    });

    test('an id that is gone and was never spelled has no token', () => {
        expect(referenceTokens(['view-gone', 'view-gone'], ITEMS)).toEqual([]);
    });
});
