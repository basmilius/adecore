import { expect, test } from 'bun:test';
import type { ChatAttachment } from '@adecore/agent-contracts';
import type { BackendEvent, BackendLaunch } from '../backends/backend.ts';
import { CodexBackend } from '../backends/codex-backend.ts';
import { DEFAULT_CODEX_CLIENT } from '../backends/codex-transport.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { fakeCodexWith, type FakeCodexOptions } from '../testing/fake-codex.ts';
import { codexProvider } from '../testing/providers.ts';
import { flush } from './chat-session.fixture.test.ts';

type Frame = { method?: string; params?: Record<string, unknown> };

async function rig(options: FakeCodexOptions = {}) {
    const requests: Frame[] = [];
    const events: BackendEvent[] = [];

    const fake = inProcess((io) => {
        const program = fakeCodexWith(options)(io);

        return {
            onLine: (line) => {
                requests.push(JSON.parse(line));
                program.onLine(line);
            }
        };
    });

    const launch: BackendLaunch = {
        command: ['codex'],
        cwd: '/tmp',
        env: {},
        selection: codexProvider.catalog.normalize(undefined),
        modelName: 'Codex',
        runtimeMode: 'supervised',
        resume: 'thread-1',
        generation: 1,
        instructions: 'Original instructions.',
        resumeNote: 'Linked context.',
        spawn: fake.spawn
    };

    const backend = new CodexBackend(launch, { onEvent: (event) => events.push(event) }, { client: DEFAULT_CODEX_CLIENT });
    await backend.start();
    requests.length = 0;
    events.length = 0;

    return { backend, requests, events };
}

test.each(['/usage', '/usage daily', ' /usage weekly ', '/usage\tcumulative', '/usage reset'])(
    '%s explains the missing menu without asking the model or redeeming a reset',
    async (text) => {
        const { backend, requests, events } = await rig();

        try {
            backend.sendTurn({ promptId: 'usage', text, preamble: null, attachments: [], mentions: [], skills: [] });
            await flush();
            const answer = events.find((event) => event.type === 'text.done');

            expect(requests).toEqual([]);
            expect(events).toContainEqual({ type: 'turn.accepted', promptId: 'usage' });
            expect(answer?.text).toContain('This chat does not support the /usage menu.');
            expect(answer?.text).toContain('Open Codex in a terminal and run /usage');
            expect(events).toContainEqual({ type: 'turn.done', promptId: 'usage', state: 'done', costUsd: 0 });
        } finally {
            await backend.dispose();
        }
    }
);

const attachment: ChatAttachment = { id: 'file', name: 'notes.txt', mime: 'text/plain', size: 4, path: '/tmp/notes.txt' };

test.each([
    { text: 'Explain /usage', attachments: [] },
    { text: '/usage-report', attachments: [] },
    { text: '/usage\nExplain this command', attachments: [] },
    { text: '/usage', attachments: [attachment] }
])('preserves normal model input for $text with $attachments', async ({ text, attachments }) => {
    const { backend, requests } = await rig();

    try {
        backend.sendTurn({ text, preamble: null, attachments: [...attachments], mentions: [], skills: [] });
        await flush();
        const turns = requests.filter((request) => request.method === 'turn/start');
        const input = turns[0]?.params?.input as { text: string }[] | undefined;

        expect(turns).toHaveLength(1);
        expect(input?.[0]?.text).toContain(`Linked context.\n\n${text}`);
    } finally {
        await backend.dispose();
    }
});

test('a usage explanation leaves resume context for the next real model turn', async () => {
    const { backend, requests } = await rig();

    try {
        backend.sendTurn({ text: '/usage', preamble: null, attachments: [], mentions: [], skills: [] });
        await flush();
        backend.sendTurn({ text: 'Continue', preamble: null, attachments: [], mentions: [], skills: [] });
        await flush();

        expect(requests.filter((request) => request.method === 'turn/start').map((request) => request.params?.input)).toEqual([
            [{ type: 'text', text: 'Linked context.\n\nContinue', text_elements: [] }]
        ]);
    } finally {
        await backend.dispose();
    }
});

test.each(['mentions', 'skills'] as const)('a usage message with chosen %s keeps its model context', async (picked) => {
    const { backend, requests } = await rig();

    try {
        backend.sendTurn({
            text: '/usage',
            preamble: 'Selected context.',
            attachments: [],
            mentions: picked === 'mentions' ? ['reference'] : [],
            skills: picked === 'skills' ? ['skill'] : []
        });

        await flush();
        const turns = requests.filter((request) => request.method === 'turn/start');

        expect(turns.map((request) => request.params?.input)).toEqual([
            [{ type: 'text', text: 'Linked context.\n\nSelected context.\n\n/usage', text_elements: [] }]
        ]);
    } finally {
        await backend.dispose();
    }
});

async function limitOnFirstRequest(options: FakeCodexOptions) {
    const { backend, events } = await rig(options);

    try {
        backend.sendTurn({ text: 'limit:unknown', preamble: null, attachments: [], mentions: [], skills: [] });
        await flush();

        return events.find((event) => event.type === 'turn.done');
    } finally {
        await backend.dispose();
    }
}

test("a usage limit on the first request takes its reset from the plan's main allowance", async () => {
    const premium = { limitId: 'premium', primary: null, secondary: null };
    const codex = { limitId: 'codex', primary: { usedPercent: 100, windowDurationMins: 300, resetsAt: 1_800_000_000 }, secondary: null };
    const done = await limitOnFirstRequest({ rateLimitsRead: { result: { rateLimits: premium, rateLimitsByLimitId: { premium, codex } } } });

    expect(done).toMatchObject({ state: 'error', limit: { kind: 'usage', resetsAt: 1_800_000_000_000 } });
});

test('a usage limit whose plan cannot be read still ends the turn, without a reset', async () => {
    const done = await limitOnFirstRequest({});

    expect(done).toMatchObject({ state: 'error', limit: { kind: 'usage' } });
    expect(done?.type === 'turn.done' ? done.limit?.resetsAt : null).toBeUndefined();
});
