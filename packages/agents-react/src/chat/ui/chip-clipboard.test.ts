import { describe, expect, test } from 'bun:test';
import type { ChatAssistantItem, ChatUserItem } from '@adecore/agent-contracts';
import type { Referables } from '../chat-references';
import { rowClipboardChips } from './chip-clipboard';

const items: Referables['items'] = [{ id: 'view-sketch', name: 'Sketch', kind: 'drawing', group: 'views' }];

describe('rowClipboardChips', () => {
    test('a message of the person carries the files, skills and views it picked', () => {
        const item = {
            id: 'asked',
            kind: 'user',
            turnId: 'turn',
            createdAt: 0,
            text: 'Fix @src/main.ts with $review, see #Sketch',
            mentions: ['src/main.ts'],
            skills: ['review'],
            references: ['view-sketch']
        } as ChatUserItem;

        expect(rowClipboardChips({ kind: 'user', id: item.id, item }, item.text, { items })).toEqual({
            text: item.text,
            mentions: ['src/main.ts'],
            skills: ['review'],
            references: [{ id: 'view-sketch', name: 'Sketch' }]
        });
    });

    test('a reply carries the views it names', () => {
        const item = { id: 'answered', kind: 'assistant', turnId: 'turn', createdAt: 1, text: 'I drew in #Sketch.', streaming: false } as ChatAssistantItem;
        expect(rowClipboardChips({ kind: 'assistant', id: item.id, item }, item.text, { items }).references).toEqual([{ id: 'view-sketch', name: 'Sketch' }]);
    });

    test('any other row is only its text', () => {
        expect(rowClipboardChips({ kind: 'note', id: 'note', level: 'info', text: 'See #Sketch' }, 'See #Sketch', { items })).toEqual({
            text: 'See #Sketch',
            mentions: [],
            skills: [],
            references: []
        });
    });
});
