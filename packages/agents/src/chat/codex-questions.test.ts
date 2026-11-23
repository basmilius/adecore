import { describe, expect, test } from 'bun:test';
import type { RuntimeMode } from '@adecore/agent-contracts';
import { isRecord } from '@adecore/utils/record';
import { CodexBackend } from '../backends/codex-backend.ts';
import { DEFAULT_CODEX_CLIENT } from '../backends/codex-transport.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { fakeCodexWith } from '../testing/fake-codex.ts';
import { codexProvider } from '../testing/providers.ts';
import { info, flush } from './chat-session.fixture.test.ts';
import { ChatSession } from './chat-session.ts';

type Frame = Record<string, unknown>;

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
        provider: {
            ...codexProvider,
            createBackend: (launch, host) => new CodexBackend({ ...launch, spawn: fake.spawn }, host, { client: DEFAULT_CODEX_CLIENT })
        },
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

function codexChat(runtimeMode: RuntimeMode, version: string | null) {
    const requests: Frame[] = [];

    const fake = inProcess((io) => {
        const program = fakeCodexWith({})(io);

        return {
            onLine: (line) => {
                requests.push(JSON.parse(line));
                program.onLine(line);
            }
        };
    });

    const session = new ChatSession({
        info: { ...info(), provider: 'codex', runtimeMode, selection: codexProvider.catalog.normalize(undefined) },
        provider: {
            ...codexProvider,
            createBackend: (launch, host) => new CodexBackend({ ...launch, spawn: fake.spawn }, host, { client: DEFAULT_CODEX_CLIENT, version })
        },
        env: () => ({}),
        emit: () => undefined,
        persist: () => undefined,
        persistSoon: () => undefined
    });

    const policy = () => requests.find((frame) => frame.method === 'thread/start')?.params as Frame | undefined;
    const replies = () => requests.filter((frame) => frame.method === undefined && frame.result !== undefined).map((frame) => frame.result);
    const cards = () => session.thread.list().filter((item) => item.kind === 'approval');
    const tool = () => session.thread.list().find((item) => item.kind === 'tool');

    return { session, policy, replies, cards, tool };
}

const FULL_ACCESS_GRANULAR = {
    granular: { mcp_elicitations: true, rules: false, sandbox_approval: false, skill_approval: false, request_permissions: false }
};

describe('Codex full access', () => {
    test.each([
        ['0.166.0', FULL_ACCESS_GRANULAR],
        ['0.167.2', FULL_ACCESS_GRANULAR],
        ['0.165.9', 'never'],
        [null, 'never']
    ] as const)('on Codex %p asks for the approval policy %p', async (version, approvalPolicy) => {
        const chat = codexChat('full-access', version);

        try {
            chat.session.send('hello');
            await flush();
            expect(chat.policy()).toMatchObject({ approvalPolicy, sandbox: 'danger-full-access' });
            expect(chat.session.info.runtimeMode).toBe('full-access');
        } finally {
            await chat.session.dispose();
        }
    });

    test('accepts a command its danger check flags, with no card', async () => {
        const chat = codexChat('full-access', '0.166.0');

        try {
            chat.session.send('danger: rm -f a.txt');
            await flush();
            expect(chat.replies()).toEqual([{ decision: 'accept' }]);
            expect(chat.cards()).toEqual([]);
            expect(chat.tool()).toMatchObject({ state: 'done', output: 'ran: rm -f a.txt\n' });
        } finally {
            await chat.session.dispose();
        }
    });

    test('leaves a command its managed network settings hold back to the person', async () => {
        const chat = codexChat('full-access', '0.166.0');

        try {
            chat.session.send('network: curl https://example.com');
            await flush();
            expect(chat.replies()).toEqual([]);
            expect(chat.cards()).toMatchObject([{ decision: 'pending' }]);
        } finally {
            await chat.session.dispose();
        }
    });

    test('accepts a yes or no an MCP server asks, with no card', async () => {
        const chat = codexChat('full-access', '0.166.0');

        try {
            chat.session.send('elicit');
            await flush();
            expect(chat.replies()).toEqual([{ action: 'accept', content: {} }]);
            expect(chat.cards()).toEqual([]);
            expect(chat.tool()).toMatchObject({ state: 'done', output: 'Notes is open' });
        } finally {
            await chat.session.dispose();
        }
    });

    test('on an older Codex never sees an MCP question, which Codex declines itself', async () => {
        const chat = codexChat('full-access', '0.165.9');

        try {
            chat.session.send('elicit');
            await flush();
            expect(chat.replies()).toEqual([]);
            expect(chat.tool()).toMatchObject({ state: 'error' });
        } finally {
            await chat.session.dispose();
        }
    });
});

test('a mode that asks shows an MCP yes or no as a card, which a deny declines', async () => {
    const chat = codexChat('auto', '0.166.0');

    try {
        chat.session.send('elicit');
        await flush();
        const [card] = chat.cards();
        expect(card).toMatchObject({ decision: 'pending', description: 'Allow Computer Use to use "Notes"?' });
        expect(chat.session.approve(card!.kind === 'approval' ? card.requestId : '', 'deny')).toBe(true);
        await flush();
        expect(chat.replies()).toEqual([{ action: 'decline' }]);
    } finally {
        await chat.session.dispose();
    }
});

test.each([
    ['full-access', 'elicit form: name'],
    ['full-access', 'elicit link: sign in'],
    ['auto', 'elicit form: name']
] as const)('in %s an MCP question no card can answer (%p) is cancelled, never declined', async (runtimeMode, prompt) => {
    const chat = codexChat(runtimeMode, '0.166.0');

    try {
        chat.session.send(prompt);
        await flush();
        expect(chat.replies()).toEqual([{ action: 'cancel' }]);
        expect(chat.cards()).toEqual([]);
        expect(chat.tool()).toMatchObject({ state: 'error' });
    } finally {
        await chat.session.dispose();
    }
});
