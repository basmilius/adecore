import { expect, test } from 'bun:test';
import { flush } from '../chat/chat-session.fixture.test.ts';
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

test("a delegated chat's new thread says it is a subagent's from Codex 0.129.0 on, and a person's chat or a resume does not", async () => {
    const sentThreadSource = async (version: string | null, extra: Partial<BackendLaunch>): Promise<unknown[]> => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
        const fake = inProcess(fakeCodexWith({ requests }));
        const backend = new CodexBackend({ ...launch, ...extra, spawn: fake.spawn }, { onEvent: () => undefined }, { client: DEFAULT_CODEX_CLIENT, version });
        await backend.start();
        await backend.dispose();

        return requests
            .filter((request) => request.method === 'thread/start' || request.method === 'thread/resume')
            .map((request) => request.params.threadSource);
    };

    expect(await sentThreadSource('0.129.0', { subagent: true })).toEqual(['subagent']);
    expect(await sentThreadSource('0.128.9', { subagent: true })).toEqual([undefined]);
    expect(await sentThreadSource('0.166.0', {})).toEqual([undefined]);
    expect(await sentThreadSource('0.166.0', { subagent: true, resume: 'thread-1' })).toEqual([undefined]);
});

test('a turn sends the cyber program model/list offers, standard first, from Codex 0.156.0 on, and none for a model without the list', async () => {
    const sentProgram = async (model: string, version: string): Promise<unknown> => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
        const fake = inProcess(fakeCodexWith({ requests, cyberPrograms: { 'gpt-cyber': ['daybreakBlue', 'standard'], 'gpt-red': ['daybreakRed'] } }));
        const selection = { ...launch.selection, model };
        const backend = new CodexBackend({ ...launch, selection, spawn: fake.spawn }, { onEvent: () => undefined }, { client: DEFAULT_CODEX_CLIENT, version });
        await backend.start();
        backend.sendTurn({ text: 'hello', preamble: null, attachments: [], mentions: [], skills: [] });
        await flush();
        await backend.dispose();

        return requests.find((request) => request.method === 'turn/start')?.params.cyberAccessProgram;
    };

    expect(await sentProgram('gpt-cyber', '0.156.0')).toBe('standard');
    expect(await sentProgram('gpt-red', '0.166.0')).toBe('daybreakRed');
    expect(await sentProgram('gpt-plain', '0.166.0')).toBeUndefined();
    expect(await sentProgram('gpt-cyber', '0.155.0')).toBeUndefined();
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
