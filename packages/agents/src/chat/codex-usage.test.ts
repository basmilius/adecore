import { expect, test } from 'bun:test';
import type { ChatAttachment } from '@adecore/agent-contracts';
import { codexProvider } from '../providers/codex-provider.ts';
import { fakeCodexWith } from '../testing/fake-codex.ts';
import { inProcess } from '../testing/fake-cli.ts';
import type { BackendEvent, BackendLaunch } from './backend.ts';
import { CodexBackend } from './codex-backend.ts';
import { flush } from './chat-session.fixture.test.ts';

type Frame = { method?: string; params?: Record<string, unknown> };

async function rig() {
    const requests: Frame[] = [];
    const events: BackendEvent[] = [];

    const fake = inProcess((io) => {
        const program = fakeCodexWith({})(io);

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

    const backend = new CodexBackend(launch, { onEvent: (event) => events.push(event) });
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
