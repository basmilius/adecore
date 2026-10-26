import { expect, test } from 'bun:test';
import { isRecord } from '@adecore/agent-contracts';
import { CodexBackend } from './codex-backend.ts';
import { ChatSession } from './chat-session.ts';
import { info, flush } from './chat-session.fixture.test.ts';
import { codexProvider } from '../providers/codex-provider.ts';
import { fakeCodexWith } from '../testing/fake-codex.ts';
import { inProcess } from '../testing/fake-cli.ts';

test.each(['answer', 'stop'] as const)('an asynchronous Codex question survives the turn until a person chooses to %s', async (action) => {
    const requests: Array<{ method?: string; params?: Record<string, unknown> }> = [];

    let complete = () => {};

    const fake = inProcess((io) => {
        const program = fakeCodexWith({})({
            ...io,
            out: (frame) => {
                if (isRecord(frame) && frame.method === 'turn/started') {
                    const params = frame.params as { threadId: string; turn: { id: string } };

                    complete = () =>
                        io.out({ method: 'turn/completed', params: { threadId: params.threadId, turn: { id: params.turn.id, status: 'completed' } } });
                }

                io.out(frame);
            }
        });

        return {
            onLine: (line) => {
                requests.push(JSON.parse(line));
                program.onLine(line);
            }
        };
    });

    const session = new ChatSession({
        info: { ...info(), provider: 'codex', selection: codexProvider.catalog.normalize(undefined) },
        provider: { ...codexProvider, createBackend: (launch, host) => new CodexBackend({ ...launch, spawn: fake.spawn }, host) },
        command: ['unused'],
        env: () => ({}),
        emit: () => undefined,
        persist: () => undefined,
        persistSoon: () => undefined
    });

    try {
        session.send('async: Which color?');
        await flush();
        const question = session.thread.find('question', () => true)!;
        expect(question).toBeDefined();
        complete();
        await flush();
        expect(session.info).toMatchObject({ status: 'needs-you', activeTurnId: null });
        expect(session.thread.get(question.id)).toMatchObject({ state: 'pending' });

        if (action === 'stop') {
            session.cancel();
            expect(session.thread.pending()).toEqual([]);
            expect(session.thread.get(question.id)).toMatchObject({ state: 'cancelled' });
            expect(requests.filter((frame) => frame.method === 'turn/start')).toHaveLength(1);

            return;
        }

        expect(session.answer(question.requestId, { '0': 'Blue' })).toBe(true);
        await flush();
        const starts = requests.filter((frame) => frame.method === 'turn/start');
        expect(starts.at(-1)?.params?.input).toEqual([{ type: 'text', text: 'Blue', text_elements: [] }]);
        expect(session.thread.get(question.id)).toMatchObject({ state: 'answered', answers: { '0': 'Blue' } });
    } finally {
        await session.dispose();
    }
});
