import { describe, expect, test } from 'bun:test';
import { EMPTY_DRAFT } from '../../drafts';
import { mayHoldChips, pastedChipsIn, withPastedChips, type PasteChoices } from './chip-paste';

const choices: PasteChoices = {
    skills: ['review'],
    referables: [
        { id: 'view-admin', name: 'Admin', kind: 'canvas', group: 'views' },
        { id: 'chat-plan', name: 'Plan', kind: 'chat', group: 'views' }
    ],
    referenced: [],
    mentions: true
};

describe('pastedChipsIn', () => {
    test('finds a skill there is and a name the project has, only inside what was pasted and outside code', () => {
        const text = 'Before $review | $review $missing #Admin? `#Admin` | after #Admin';
        const from = text.indexOf('|') + 2;
        const to = text.lastIndexOf('|') - 1;

        expect(pastedChipsIn(text, from, to, [{ from: text.indexOf('`'), to: text.lastIndexOf('`') + 1 }], choices)).toEqual({
            text: text.slice(from, to),
            mentions: [],
            skills: ['review'],
            references: [{ id: 'view-admin', name: 'Admin' }]
        });
    });

    test('a paste that spells no chip of its own is left to the editor', () => {
        expect(mayHoldChips('price $20, heading # Title')).toBe(false);
        expect(mayHoldChips('see (#Admin)')).toBe(true);
        expect(mayHoldChips('$review it')).toBe(true);
    });
});

describe('withPastedChips', () => {
    test('adds what is new, a chat apart from a view, under the name the text spells', () => {
        const draft = { ...EMPTY_DRAFT, mentions: ['a.ts'], references: ['view-admin'] };

        const next = withPastedChips(
            draft,
            {
                text: '',
                mentions: ['a.ts', 'b.ts'],
                skills: ['review'],
                references: [
                    { id: 'view-admin', name: 'Admin' },
                    { id: 'chat-plan', name: 'Plan' }
                ]
            },
            choices
        );

        expect(next).toMatchObject({
            mentions: ['a.ts', 'b.ts'],
            skills: ['review'],
            chats: ['chat-plan'],
            references: ['view-admin'],
            referenceNames: { 'view-admin': 'Admin', 'chat-plan': 'Plan' }
        });
    });

    test('a CLI that does not read @path keeps the paths as text', () => {
        const next = withPastedChips(EMPTY_DRAFT, { text: '', mentions: ['a.ts'], skills: [], references: [] }, { ...choices, mentions: false });
        expect(next.mentions).toEqual([]);
    });
});
