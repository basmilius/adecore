import { expect, test } from 'bun:test';
import type { ChatQuestionItem } from '@adecore/agent-contracts';
import { flush, info, rig } from '../chat/chat-session.fixture.test.ts';
import { ChatSession } from '../chat/chat-session.ts';
import { claudeProvider } from '../providers/claude-provider.ts';
import type { DeliverWaitingEntry } from './task-work.ts';
import { deliverWaitingHandler, waitingNoteId, waitingTexts } from './waiting-child.ts';

test('a long question in a waiting note is cut between two characters', () => {
    // The emoji straddles the 199th unit, where the note cuts to make room for the ellipsis.
    const question = `${'q'.repeat(198)}😀 and the rest of it`;

    const item: ChatQuestionItem = {
        id: 'question-r1',
        kind: 'question',
        createdAt: 1,
        turnId: null,
        requestId: 'r1',
        questions: [{ id: 'q1', header: 'Choice', question, choices: [], multiSelect: false }],
        answers: null,
        state: 'pending'
    };

    const { note } = waitingTexts({ id: 'child', title: 'Child' }, item, { app: 'Ruimte', cli: 'ruimte-context' });
    expect(note.split('\n')[0]).toBe(`Child (node child) waits for an answer to ${JSON.stringify(`${'q'.repeat(198)}…`)}`);
});

test('the answer call is the cli verb by default, and the host its own words where it passes them', () => {
    const item: ChatQuestionItem = {
        id: 'question-r1',
        kind: 'question',
        createdAt: 1,
        turnId: null,
        requestId: 'r1',
        questions: [{ id: 'q1', header: 'Choice', question: 'Which one?', choices: [], multiSelect: true }],
        answers: null,
        state: 'pending'
    };

    const byCli = waitingTexts({ id: 'child', title: 'Child' }, item, { app: 'Host', cli: 'host-context' });

    const byTool = waitingTexts({ id: 'child', title: 'Child' }, item, {
        app: 'Host',
        answerCall: (childId, asked) => `answer_tool {"id":"${childId}","request":"${asked.requestId}","questions":${asked.questions.length}}`
    });

    expect(byCli.preamble).toContain(
        "this chat with host-context answer child r1 --answer '<a choice label as written, or your own words>', several labels in one --answer separated by a comma."
    );
    expect(byTool.preamble).toContain('this chat with answer_tool {"id":"child","request":"r1","questions":1}. Whoever answers first wins');
    expect(byTool.note).not.toContain('--answer');
});

function pendingQuestion(): ChatQuestionItem {
    return {
        id: 'question-r1',
        kind: 'question',
        createdAt: 1,
        turnId: null,
        requestId: 'r1',
        questions: [{ id: 'q1', header: 'Choice', question: 'Which one?', choices: [], multiSelect: false }],
        answers: null,
        state: 'pending'
    };
}

test('the note names the waiting child and opens no turn in its parent', async () => {
    const parent = new ChatSession({
        info: {
            chatId: 'parent',
            provider: 'claude',
            cwd: '/tmp',
            agentSessionId: null,
            model: null,
            selection: claudeProvider.catalog.normalize(undefined),
            runtimeMode: 'supervised',
            status: 'idle',
            running: false,
            activeTurnId: null,
            slashCommands: [],
            usage: { contextTokens: 0, contextWindow: 200000, costUsd: 0, turns: 0 },
            createdAt: 1
        },
        provider: claudeProvider,
        command: ['unused'],
        env: () => ({}),
        emit: () => undefined,
        persist: () => undefined,
        persistSoon: () => undefined
    });

    const handler = deliverWaitingHandler({
        request: () => pendingQuestion(),
        titleFor: () => 'Child',
        deliver: (_chatId, delivery) => Promise.resolve(parent.deliverNote(delivery)),
        words: { app: 'Ruimte', cli: 'ruimte-context' }
    });

    await handler({ id: 'e1', kind: 'deliver-waiting', target: 'parent', payload: { childId: 'child', requestId: 'r1' } } as DeliverWaitingEntry);
    expect(parent.thread.get(waitingNoteId('child', 'r1'))).toMatchObject({ kind: 'note', from: 'child' });
    expect(parent.info.activeTurnId).toBeNull();
    await parent.dispose();
});

test('a question answered before the parent next speaks leaves its note but not its preamble', async () => {
    const parent = rig({ info: { ...info(), chatId: 'parent' } });
    const requests = new Map([pendingQuestion(), { ...pendingQuestion(), id: 'question-r2', requestId: 'r2' }].map((item) => [item.requestId, item]));

    const handler = deliverWaitingHandler({
        request: (_childId, requestId) => requests.get(requestId) ?? null,
        titleFor: () => 'Child',
        deliver: (_chatId, delivery) => Promise.resolve(parent.session.deliverNote(delivery)),
        words: { app: 'Ruimte', cli: 'ruimte-context' }
    });

    for (const requestId of ['r1', 'r2']) {
        await handler({ id: requestId, kind: 'deliver-waiting', target: 'parent', payload: { childId: 'child', requestId } } as DeliverWaitingEntry);
    }

    requests.set('r1', { ...requests.get('r1')!, answers: { q1: 'This one' }, state: 'answered' });
    parent.session.send('Carry on');
    await flush();
    expect(parent.sent).toHaveLength(1);
    expect(parent.sent[0]!.preamble).toContain('(request r2)');
    expect(parent.sent[0]!.preamble).not.toContain('(request r1)');
    expect(parent.session.thread.get(waitingNoteId('child', 'r1'))).toMatchObject({ kind: 'note', from: 'child' });
    await parent.session.dispose();
});
