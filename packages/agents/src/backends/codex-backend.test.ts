import { expect, test } from 'bun:test';
import { inProcess } from '../testing/fake-cli.ts';
import { fakeCodexWith } from '../testing/fake-codex.ts';
import { codexProvider } from '../testing/providers.ts';
import type { BackendEvent, BackendLaunch } from './backend.ts';
import { CodexBackend } from './codex-backend.ts';
import { DEFAULT_CODEX_CLIENT } from './codex-transport.ts';

const launch: BackendLaunch = {
    command: ['codex'],
    cwd: '/tmp',
    env: {},
    selection: codexProvider.catalog.normalize(undefined),
    modelName: 'Codex',
    runtimeMode: 'supervised',
    resume: null,
    generation: 1,
    instructions: null,
    resumeNote: null
};

test('a Codex that exits before it answers initialize fails the start with its stderr and exit code', async () => {
    const fake = inProcess(fakeCodexWith({ exitBeforeInit: 'Error: unknown flag --listen' }));
    const backend = new CodexBackend({ ...launch, spawn: fake.spawn }, { onEvent: () => undefined }, { client: DEFAULT_CODEX_CLIENT });
    const failure = await backend.start().catch((error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain('Error: unknown flag --listen');
    expect((failure as Error).message).toContain('code 1');
    expect(backend.running).toBe(false);
});

test('a thread on Codex 0.166.0 turns the plan tool on, and one on an unknown version leaves its config alone', async () => {
    const threadConfig = async (version: string | null): Promise<unknown> => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
        const fake = inProcess(fakeCodexWith({ requests }));
        const backend = new CodexBackend({ ...launch, spawn: fake.spawn }, { onEvent: () => undefined }, { client: DEFAULT_CODEX_CLIENT, version });
        await backend.start();
        await backend.dispose();

        return requests.find((request) => request.method === 'thread/start')?.params.config;
    };

    expect(await threadConfig('0.166.0')).toEqual({ 'tools.update_plan.enabled': true });
    expect(await threadConfig(null)).toBeUndefined();
});

test('a server request whose handling throws gets an internal error reply, and the chat fails as before', async () => {
    const errorReplies: Record<string, unknown>[] = [];
    const fake = inProcess(fakeCodexWith({ errorReplies }));
    const events: BackendEvent[] = [];
    let settle: () => void = () => undefined;

    const failed = new Promise<void>((resolve) => {
        settle = resolve;
    });

    const host = {
        onEvent: (event: BackendEvent) => {
            if (event.type === 'approval.requested') {
                throw new Error('the host choked on the request');
            }

            events.push(event);

            if (event.type === 'failed') {
                settle();
            }
        }
    };

    const backend = new CodexBackend({ ...launch, spawn: fake.spawn }, host, { client: DEFAULT_CODEX_CLIENT });
    await backend.start();
    backend.sendTurn({ text: 'danger: rm -rf build', preamble: null, attachments: [], mentions: [], skills: [] });
    await failed;

    expect(errorReplies).toEqual([{ id: 0, error: { code: -32603, message: expect.stringContaining('the host choked on the request') } }]);
    expect(events.find((event) => event.type === 'failed')).toMatchObject({ message: expect.stringContaining('the host choked on the request') });
    await backend.dispose();
});
