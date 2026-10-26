import { describe, expect, test } from 'bun:test';
import type { RuntimeMode } from '@adecore/agent-contracts';
import { fakeAcpCapture, type AcpCapture } from '../testing/fake-acp-capture.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { createAcpBackend } from './acp-backend.ts';
import type { BackendEvent, ChatBackend } from './backend.ts';
import antigravityQuestion from './fixtures/antigravity-1.4.1-question.json';
import grokQuestion from './fixtures/grok-1.0.62-question.json';

type QuestionEvent = Extract<BackendEvent, { type: 'question.requested' }>;

/* A backend on a capture, the events it raised, every answer the agent got, and the next event of a kind. */
async function open(capture: AcpCapture, runtimeMode: RuntimeMode = 'supervised') {
    const events: BackendEvent[] = [];
    const answers: unknown[] = [];
    const waiters: Array<{ type: BackendEvent['type']; resolve(event: BackendEvent): void }> = [];
    const fake = inProcess(fakeAcpCapture(capture, answers));

    const backend: ChatBackend = createAcpBackend({ name: 'Agent' })(
        {
            command: ['agent'],
            cwd: '/tmp',
            env: {},
            selection: { model: 'default', options: {} },
            modelName: 'Default',
            runtimeMode,
            resume: null,
            generation: 1,
            instructions: null,
            resumeNote: null,
            spawn: fake.spawn
        },
        {
            onEvent: (event) => {
                events.push(event);

                for (const waiter of waiters.splice(0)) {
                    if (waiter.type === event.type) {
                        waiter.resolve(event);
                    } else {
                        waiters.push(waiter);
                    }
                }
            }
        }
    );

    const next = <T extends BackendEvent['type']>(type: T): Promise<Extract<BackendEvent, { type: T }>> => {
        const raised = events.find((event) => event.type === type);

        if (raised) {
            return Promise.resolve(raised as Extract<BackendEvent, { type: T }>);
        }

        return new Promise((resolve) => {
            waiters.push({ type, resolve: (event) => resolve(event as Extract<BackendEvent, { type: T }>) });
        });
    };

    await backend.start();
    backend.sendTurn({ promptId: 'prompt-1', text: 'Set it up.', preamble: null, attachments: [], mentions: [], skills: [] });

    return { backend, events, answers, next };
}

describe('Grok 1.0.62', () => {
    test('asks its questions on the question card, multi-select included', async () => {
        const { backend, next } = await open(grokQuestion);
        const asked: QuestionEvent = await next('question.requested');

        expect(asked.questions).toEqual([
            {
                id: '0',
                header: '',
                question: 'Which database should the service use?',
                choices: [
                    { label: 'Postgres', description: 'The one the other services run on' },
                    { label: 'SQLite', description: 'A file beside the service' }
                ],
                multiSelect: false
            },
            {
                id: '1',
                header: '',
                question: 'Which checks should run before a release?',
                choices: [
                    { label: 'Tests', description: 'The unit tests' },
                    { label: 'Lint, strict', description: 'Every warning fails' },
                    { label: 'Types', description: 'The type check' }
                ],
                multiSelect: true
            },
            { id: '2', header: '', question: 'Anything else to keep in mind?', choices: [{ label: 'No', description: 'Nothing' }], multiSelect: false }
        ]);

        await backend.dispose();
    });

    test('answers in its own shape: labels per question text, and words of the person under Other', async () => {
        const { backend, answers, next } = await open(grokQuestion);
        const asked = await next('question.requested');

        expect(backend.respondQuestion(asked.requestId, { '0': 'SQLite', '1': 'Tests, Lint, strict', '2': 'Keep the old schema around for a week.' })).toBe(
            true
        );

        await next('turn.done');

        expect(answers).toEqual([
            {
                outcome: 'accepted',
                answers: {
                    'Which database should the service use?': ['SQLite'],
                    'Which checks should run before a release?': ['Tests', 'Lint, strict'],
                    'Anything else to keep in mind?': ['Other']
                },
                annotations: { 'Anything else to keep in mind?': { notes: 'Keep the old schema around for a week.' } }
            }
        ]);

        await backend.dispose();
    });

    test('a question turned down goes back cancelled, and a stopped turn withdraws it', async () => {
        const declined = await open(grokQuestion);
        const asked = await declined.next('question.requested');
        expect(declined.backend.declineRequest?.(asked.requestId, 'Stopped')).toBe(true);
        await declined.next('turn.done');
        expect(declined.answers).toEqual([{ outcome: 'cancelled' }]);
        await declined.backend.dispose();

        const stopped = await open(grokQuestion);
        const waiting = await stopped.next('question.requested');
        stopped.backend.interrupt();
        expect(await stopped.next('request.withdrawn')).toEqual({ type: 'request.withdrawn', requestId: waiting.requestId });
        expect(stopped.answers).toEqual([{ outcome: 'cancelled' }]);
        await stopped.backend.dispose();
    });
});

describe('Antigravity 1.4.1', () => {
    test('asks a question it sends as a permission request on the question card, even in full access', async () => {
        const { backend, events, answers, next } = await open(antigravityQuestion, 'full-access');
        const asked = await next('question.requested');

        expect(asked.questions).toEqual([
            {
                id: '0',
                header: '',
                question: 'Which test runner should I set up?',
                choices: [
                    { label: 'The built-in runner', description: '' },
                    { label: 'A separate runner', description: '' }
                ],
                multiSelect: false
            }
        ]);
        expect(events.some((event) => event.type === 'approval.requested')).toBe(false);
        expect(backend.respondQuestion(asked.requestId, { '0': 'A separate runner' })).toBe(true);
        await next('turn.done');
        expect(answers).toEqual([{ outcome: { outcome: 'selected', optionId: 'opt_separate' } }]);
        await backend.dispose();
    });

    test('turns an answer in words of its own down, since the agent takes only its choices', async () => {
        const { backend, answers, next } = await open(antigravityQuestion);
        const asked = await next('question.requested');
        expect(backend.respondQuestion(asked.requestId, { '0': 'Whatever is fastest' })).toBe(true);
        expect(await next('note')).toMatchObject({ level: 'warning' });
        await next('turn.done');
        expect(answers).toEqual([{ outcome: { outcome: 'cancelled' } }]);
        await backend.dispose();
    });
});
