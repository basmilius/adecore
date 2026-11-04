import type { ChatQuestionItem } from '@adecore/agent-contracts';
import { field } from '../context/refusal.ts';
import { orNote, ToolRefusal } from '../context/tool.ts';
import type { ChatRequests, WaitingRequest } from './waiting-child.ts';

export interface QuestionAnswer {
    /* The answer to a request of one question. */
    answer: string | null;

    /* One answer per question id, for a request of several. */
    answers: Record<string, string> | null;
}

/* How the call names its two inputs, so a refusal tells the caller what to type: `answer`, or `--answer` for a command. */
export interface AnswerFieldNames {
    answer: string;
    answers: string;
}

const FIELD_NAMES: AnswerFieldNames = { answer: 'answer', answers: 'answers' };

/* One row per request an agent waits on, which is what a refusal offers instead. */
function requestLine(nodeId: string, item: WaitingRequest): string {
    return item.kind === 'question'
        ? `question\t${nodeId}\t${item.requestId}\t${item.questions.map((question) => `${question.id}: ${field(question.question)}`).join(' | ')}`
        : `approval\t${nodeId}\t${item.requestId}\t${field(item.toolName)}\ta person's alone`;
}

function waitingLines(requests: ChatRequests, nodeId: string): string[] {
    return orNote(
        requests.waiting(nodeId).map((item) => requestLine(nodeId, item)),
        `${nodeId} waits on no question now`
    );
}

/* The answers keyed by question id, from the one answer or the map a call gave, refused while one is missing. */
function answersFor(item: ChatQuestionItem, given: QuestionAnswer, names: AnswerFieldNames): Record<string, string> {
    const ids = item.questions.map((question) => question.id);
    let answers = given.answers;

    if (given.answer !== null && answers !== null) {
        throw new ToolRefusal('answer-twice', `${names.answer} and ${names.answers} both carry the answer; give one of them`);
    }

    if (given.answer !== null) {
        if (ids.length !== 1) {
            throw new ToolRefusal('answers-needed', `This request asks ${ids.length} questions; give ${names.answers} with one answer per question id`, [
                `note\t${names.answers} '${JSON.stringify(Object.fromEntries(ids.map((id) => [id, '...'])))}'`
            ]);
        }

        answers = { [ids[0]!]: given.answer };
    }

    const trimmed = Object.fromEntries(Object.entries(answers ?? {}).map(([id, text]) => [id, text.trim()]));
    const unknown = Object.keys(trimmed).filter((id) => !ids.includes(id));

    if (unknown.length > 0) {
        throw new ToolRefusal('unknown-question', `${unknown.join(', ')} is not a question of this request; its ids are ${ids.join(', ')}`);
    }

    const missing = ids.filter((id) => (trimmed[id] ?? '') === '');

    if (missing.length > 0) {
        throw new ToolRefusal(
            'empty-answer',
            ids.length === 1
                ? `The answer is empty; give it with ${names.answer}`
                : `Question ${missing.join(', ')} has no answer; every question of the request needs one`
        );
    }

    return trimmed;
}

/*
 * Answers a question an agent waits on, through the same door a person's `chat.answer` goes through, so
 * whoever answers second is refused. An approval is a person's alone and is refused. Whether the caller
 * may answer for this agent at all is the host's to check first.
 */
export function answerQuestion(requests: ChatRequests, nodeId: string, requestId: string, given: QuestionAnswer, names: AnswerFieldNames = FIELD_NAMES): void {
    const item = requests.request(nodeId, requestId);

    if (item === null) {
        throw new ToolRefusal('unknown-request', `${nodeId} asked nothing under ${requestId}`, waitingLines(requests, nodeId));
    }

    if (item.kind === 'approval') {
        throw new ToolRefusal(
            'not-a-question',
            `${requestId} asks a person to approve ${field(item.toolName)}; an approval is a person's alone, so tell the person if it holds up your plan`,
            waitingLines(requests, nodeId)
        );
    }

    if (item.state !== 'pending') {
        throw new ToolRefusal('not-pending', `${requestId} no longer waits: it was ${item.state}`, waitingLines(requests, nodeId));
    }

    if (!requests.answer(nodeId, requestId, answersFor(item, given, names))) {
        throw new ToolRefusal('not-pending', `${requestId} no longer waits: it was answered a moment ago`, waitingLines(requests, nodeId));
    }
}
