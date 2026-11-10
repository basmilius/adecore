import { describe, expect, test } from 'bun:test';
import type { ChatAssistantItem, ChatToolItem, ChatTurnItem, ChatUserItem, ChatVisual } from '@adecore/agent-contracts';
import type { TimelineRow } from '../../../host/timeline-row';
import { replyHeader, rowRhythm, saidToChat } from './row-rhythm';

function user(id: string, createdAt = 0): TimelineRow {
    return { kind: 'user', id, item: { id, kind: 'user', createdAt } as ChatUserItem };
}

function opener(id: string, createdAt: number): TimelineRow {
    return { kind: 'turn-start', id, label: '', turn: { id, kind: 'turn', createdAt } as ChatTurnItem };
}

function prose(id: string): TimelineRow {
    return { kind: 'assistant', id, item: { id, kind: 'assistant' } as ChatAssistantItem };
}

function call(id: string): TimelineRow {
    return { kind: 'work', id, tool: { id, kind: 'tool' } as ChatToolItem };
}

function visual(id: string): TimelineRow {
    return { kind: 'visual', id, visual: { id } as ChatVisual };
}

function card(id: string): TimelineRow {
    return { kind: 'app-card', id, card: { id, at: 0, render: () => null } };
}

describe('the gaps a row wears', () => {
    test('a question makes room for the answer under it', () => {
        expect(rowRhythm(user('u1'), null)).toContain('pb-(--chat-answer-gap)');
        expect(rowRhythm(prose('a1'), null)).toBe('');
    });

    test('the seam where tool lines meet prose gets the block gap', () => {
        expect(rowRhythm(prose('a1'), call('w1'))).toBe('pt-(--chat-block-gap)');
        expect(rowRhythm(call('w2'), prose('a1'))).toBe('pt-(--chat-block-gap)');
    });

    test('two rows of one rhythm sit tight against each other', () => {
        expect(rowRhythm(call('w2'), call('w1'))).toBe('');
        expect(rowRhythm(prose('a2'), prose('a1'))).toBe('');
    });

    test('the row under a visual gets the block gap', () => {
        expect(rowRhythm(prose('a1'), visual('v1'))).toBe('pt-(--chat-block-gap)');
        expect(rowRhythm(visual('v1'), prose('a1'))).toBe('');
    });

    test('the row under an app card gets the block gap, as under a visual', () => {
        expect(rowRhythm(prose('a1'), card('c1'))).toBe('pt-(--chat-block-gap)');
        expect(rowRhythm(call('w1'), card('c1'))).toBe('pt-(--chat-block-gap)');
        expect(rowRhythm(card('c1'), call('w1'))).toBe('pt-(--chat-block-gap)');
    });

    // A question already carries the gap before it, and the row after one is its answer.
    test('nothing around a question counts as a seam', () => {
        expect(rowRhythm(prose('a1'), user('u1'))).toBe('');
        expect(rowRhythm(user('u1'), prose('a1'))).toBe('pb-(--chat-answer-gap)');
    });

    test('a note the host said is a question where the host draws it as a message, and a note line where it does not', () => {
        const said: TimelineRow = { kind: 'note', id: 'n1', level: 'info', text: 'the linked context changed', said: true };

        expect(rowRhythm(said, prose('a0'), true)).toBe('pb-(--chat-answer-gap)');
        expect(rowRhythm(call('w1'), said, true)).toBe('');
        expect(rowRhythm(said, prose('a0'))).toBe('pt-(--chat-block-gap)');
        expect(saidToChat(said)).toBe(false);
    });
});

describe('where a reply gets its header', () => {
    test('over the first row after the question, dated when it was asked', () => {
        expect(replyHeader(prose('a1'), user('u1', 1000))).toEqual({ at: 1000 });
        expect(replyHeader(call('w1'), user('u1', 1000))).toEqual({ at: 1000 });
    });

    test('over the first row of a turn the agent opened itself', () => {
        expect(replyHeader(prose('a1'), opener('t1', 2000))).toEqual({ at: 2000 });
        expect(replyHeader(opener('t1', 2000), prose('a0'))).toBeNull();
    });

    test('not again further into the reply', () => {
        expect(replyHeader(prose('a2'), call('w1'))).toBeNull();
        expect(replyHeader(prose('a2'), prose('a1'))).toBeNull();
    });

    test('never over a question', () => {
        expect(replyHeader(user('u2'), prose('a1'))).toBeNull();
        expect(replyHeader(user('u1'), null)).toBeNull();
    });

    test('without a time on a thread that starts halfway through a reply', () => {
        expect(replyHeader(prose('a1'), null)).toEqual({ at: null });
    });
});

describe('a run of sent messages', () => {
    const sent = (id: string): TimelineRow => ({
        kind: 'sent',
        id,
        tool: { id, kind: 'tool' } as ChatToolItem,
        sent: { to: 'chat-b', text: 'hi', state: 'delivered' }
    });

    test('sits tight inside and takes the block gap at each end', () => {
        expect(rowRhythm(sent('b'), sent('a'))).toBe('');
        expect(rowRhythm(sent('a'), prose('p'))).toContain('chat-block-gap');
        expect(rowRhythm(prose('p'), sent('a'))).toContain('chat-block-gap');
        expect(rowRhythm(sent('a'), call('c'))).toContain('chat-block-gap');
    });

    test('takes no reply header of its own after it', () => {
        expect(replyHeader(prose('p'), sent('a'))).toBeNull();
    });
});
