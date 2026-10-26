import { expect, test } from 'bun:test';
import { CodexBackend } from './codex-backend.ts';
import { codexProvider } from '../providers/codex-provider.ts';
import { fakeCodexWith, type FakeCodexOptions } from '../testing/fake-codex.ts';
import { inProcess } from '../testing/fake-cli.ts';
import type { BackendLaunch } from './backend.ts';

type Frame = { method?: string; params?: Record<string, unknown> };

const launch: BackendLaunch = {
    command: ['codex'],
    cwd: '/tmp',
    env: {},
    selection: codexProvider.catalog.normalize(undefined),
    modelName: 'Codex',
    runtimeMode: 'supervised',
    resume: 'thread-1',
    generation: 1,
    instructions: 'Instructions the thread started with.',
    resumeNote: 'Linked context.'
};

/* Resumes `thread-1`, sends one prompt and hands back every request the app-server was asked. */
async function resumeAndSend(overrides: Partial<BackendLaunch>, options: FakeCodexOptions = {}): Promise<Frame[]> {
    const requests: Frame[] = [];
    let turnSent: (() => void) | null = null;

    const sent = new Promise<void>((resolve) => {
        turnSent = resolve;
    });

    const fake = inProcess((io) => {
        const program = fakeCodexWith(options)(io);

        return {
            onLine: (line) => {
                const frame = JSON.parse(line) as Frame;

                if (frame.method) {
                    requests.push(frame);
                }

                program.onLine(line);

                if (frame.method === 'turn/start') {
                    turnSent?.();
                }
            }
        };
    });

    const backend = new CodexBackend({ ...launch, ...overrides, spawn: fake.spawn }, { onEvent: () => undefined });
    await backend.start();
    backend.sendTurn({ text: 'hello', preamble: null, attachments: [], mentions: [], skills: [] });
    await sent;
    await backend.dispose();

    return requests;
}

function firstPrompt(requests: Frame[]): string {
    const input = requests.find((request) => request.method === 'turn/start')?.params?.input as Array<{ text: string }> | undefined;

    return input?.[0]?.text ?? '';
}

test('a resumed thread takes in changed instructions as a developer message, ahead of its next prompt', async () => {
    const requests = await resumeAndSend({ resumeInstructions: 'Instructions as they stand now.' });

    expect(requests.map((request) => request.method)).toEqual([
        'initialize',
        'initialized',
        'thread/resume',
        'thread/inject_items',
        'model/list',
        'thread/goal/get',
        'turn/start'
    ]);
    expect(requests.find((request) => request.method === 'thread/resume')?.params?.developerInstructions).toBeUndefined();
    expect(requests.find((request) => request.method === 'thread/inject_items')?.params).toEqual({
        threadId: 'thread-1',
        items: [{ type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'Instructions as they stand now.' }] }]
    });
    expect(firstPrompt(requests)).toBe('Linked context.\n\nhello');
});

test('a resumed thread that holds its instructions injects nothing', async () => {
    const requests = await resumeAndSend({});
    expect(requests.some((request) => request.method === 'thread/inject_items')).toBe(false);
    expect(firstPrompt(requests)).toBe('Linked context.\n\nhello');
});

test('an app-server without inject_items hears the changed instructions in front of the prompt', async () => {
    const requests = await resumeAndSend({ resumeInstructions: 'Instructions as they stand now.' }, { injectItems: false });
    expect(firstPrompt(requests)).toBe('Instructions as they stand now.\n\nLinked context.\n\nhello');
});

test('a new thread starts with the instructions and injects none', async () => {
    const requests = await resumeAndSend({ resume: null, resumeInstructions: 'Instructions as they stand now.' });
    expect(requests.find((request) => request.method === 'thread/start')?.params?.developerInstructions).toBe('Instructions the thread started with.');
    expect(requests.some((request) => request.method === 'thread/inject_items')).toBe(false);
    expect(firstPrompt(requests)).toBe('hello');
});
