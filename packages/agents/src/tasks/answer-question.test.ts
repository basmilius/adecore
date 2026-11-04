import { describe, expect, test } from 'bun:test';
import type { ChatApprovalItem, ChatQuestionItem } from '@adecore/agent-contracts';
import { ToolRefusal } from '../context/tool.ts';
import { answerQuestion } from './answer-question.ts';
import type { ChatRequests, WaitingRequest } from './waiting-child.ts';

function question(requestId: string, ids: string[], state: ChatQuestionItem['state'] = 'pending'): ChatQuestionItem {
    return {
        id: `question-${requestId}`,
        kind: 'question',
        createdAt: 1,
        turnId: null,
        requestId,
        questions: ids.map((id) => ({ id, header: id, question: `What about ${id}?`, choices: [], multiSelect: false })),
        answers: null,
        state
    };
}

const approval = { id: 'approval-a1', kind: 'approval', requestId: 'a1', toolName: 'Bash', decision: 'pending' } as unknown as ChatApprovalItem;

function requestsOf(items: WaitingRequest[], answerable = true) {
    const answered: Record<string, string>[] = [];
    const requests: ChatRequests = {
        request: (_nodeId, requestId) => items.find((item) => item.requestId === requestId) ?? null,
        waiting: () => items,
        answer: (_nodeId, _requestId, answers) => {
            answered.push(answers);

            return answerable;
        }
    };

    return { requests, answered };
}

function refusalOf(run: () => void): { code: string; message: string; lines: string[] } {
    try {
        run();
    } catch (e) {
        if (e instanceof ToolRefusal) {
            return { code: e.code, message: e.message, lines: e.lines };
        }

        throw e;
    }

    throw new Error('the call was not refused');
}

describe('answerQuestion', () => {
    test('answers a request of one question with the one answer, trimmed', () => {
        const { requests, answered } = requestsOf([question('r1', ['q1'])]);

        answerQuestion(requests, 'child', 'r1', { answer: ' yes ', answers: null });

        expect(answered).toEqual([{ q1: 'yes' }]);
    });

    test('takes one answer per question id for a request of several', () => {
        const { requests, answered } = requestsOf([question('r1', ['q1', 'q2'])]);

        answerQuestion(requests, 'child', 'r1', { answer: null, answers: { q1: 'a', q2: 'b' } });

        expect(answered).toEqual([{ q1: 'a', q2: 'b' }]);
    });

    test('refuses a single answer to several questions, in the field names the host gave', () => {
        const { requests } = requestsOf([question('r1', ['q1', 'q2'])]);
        const refusal = refusalOf(() => answerQuestion(requests, 'child', 'r1', { answer: 'a', answers: null }, { answer: '--answer', answers: '--answers' }));

        expect(refusal.code).toBe('answers-needed');
        expect(refusal.message).toBe('This request asks 2 questions; give --answers with one answer per question id');
        expect(refusal.lines).toEqual([`note\t--answers '{"q1":"...","q2":"..."}'`]);
    });

    test('refuses both inputs, an unknown question and a missing answer', () => {
        const { requests } = requestsOf([question('r1', ['q1', 'q2'])]);

        expect(refusalOf(() => answerQuestion(requests, 'child', 'r1', { answer: 'a', answers: { q1: 'a' } })).code).toBe('answer-twice');
        expect(refusalOf(() => answerQuestion(requests, 'child', 'r1', { answer: null, answers: { q9: 'a' } })).code).toBe('unknown-question');
        expect(refusalOf(() => answerQuestion(requests, 'child', 'r1', { answer: null, answers: { q1: 'a', q2: ' ' } })).message).toBe(
            'Question q2 has no answer; every question of the request needs one'
        );
    });

    test("refuses an approval, which is a person's alone, and lists what the agent waits on", () => {
        const { requests } = requestsOf([approval, question('r1', ['q1'])]);
        const refusal = refusalOf(() => answerQuestion(requests, 'child', 'a1', { answer: 'yes', answers: null }));

        expect(refusal.code).toBe('not-a-question');
        expect(refusal.lines).toEqual(["approval\tchild\ta1\tBash\ta person's alone", 'question\tchild\tr1\tq1: What about q1?']);
    });

    test('refuses an unknown request, one that no longer waits and one a person answered first', () => {
        expect(refusalOf(() => answerQuestion(requestsOf([]).requests, 'child', 'r1', { answer: 'a', answers: null })).lines).toEqual([
            'note\tchild waits on no question now'
        ]);
        expect(
            refusalOf(() => answerQuestion(requestsOf([question('r1', ['q1'], 'answered')]).requests, 'child', 'r1', { answer: 'a', answers: null })).code
        ).toBe('not-pending');
        expect(
            refusalOf(() => answerQuestion(requestsOf([question('r1', ['q1'])], false).requests, 'child', 'r1', { answer: 'a', answers: null })).message
        ).toBe('r1 no longer waits: it was answered a moment ago');
    });
});
