import { existsSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import type { AcpSessionInfo } from '../../chat/acp-protocol.ts';
import { fakeAcpWith, type FakeAcpOptions } from '../../testing/fake-acp.ts';
import { inProcess, type FakeCli } from '../../testing/fake-cli.ts';
import { ManualClock } from '../../testing/manual-clock.ts';
import { askAcpAccount } from './acp-account.ts';
import { ASK_TIMEOUT_MS } from './status.ts';

type Frame = { method?: string; params?: Record<string, unknown> };

/* A fake agent that notes the folder it started in and every frame it was sent. */
function recorded(cli: FakeCli) {
    const sent: Frame[] = [];
    const folders: string[] = [];

    let heard: () => void = () => undefined;

    const firstFrame = new Promise<void>((resolve) => {
        heard = resolve;
    });

    const fake = inProcess((io) => {
        folders.push(io.cwd);
        const program = cli(io);

        return {
            onLine: (line) => {
                sent.push(JSON.parse(line) as Frame);
                heard();
                program.onLine(line);
            }
        };
    });

    return { fake, sent, folders, firstFrame, methods: () => sent.flatMap((frame) => (frame.method ? [frame.method] : [])) };
}

function probe(cli: FakeCli, extra: { timer?: ManualClock; onSession?(info: AcpSessionInfo): void; onCommands?(commands: string[]): void } = {}) {
    const run = recorded(cli);
    const reading = askAcpAccount({ name: 'Fake', command: ['fake-acp'], env: { HOME: '/home/fake', UNSET: undefined }, spawn: run.fake.spawn, ...extra });

    return { ...run, reading };
}

const agent = (options: FakeAcpOptions = {}): FakeCli => fakeAcpWith(options);

describe('askAcpAccount', () => {
    test('reads a session the agent opens as signed in, in an empty folder of its own', async () => {
        const sessions: AcpSessionInfo[] = [];
        const run = probe(agent(), { onSession: (info) => sessions.push(info) });
        expect(await run.reading).toEqual({ signedIn: true, email: null, plan: null, organization: null });
        const folder = run.folders[0]!;
        expect(run.sent.find((frame) => frame.method === 'session/new')?.params).toEqual({ cwd: folder, mcpServers: [] });
        expect(sessions[0]?.models?.models.map((model) => model.id)).toEqual(['fake-small', 'fake-large']);
        expect(existsSync(folder)).toBe(false);
        expect(await run.fake.started[0]!.exited).toBeNull();
    });

    test('hands on the commands the session listed before the agent named it', async () => {
        const listed: string[][] = [];
        const run = probe(agent({ commands: ['compact'] }), { onCommands: (commands) => listed.push(commands) });
        await run.reading;
        expect(listed).toEqual([['compact']]);
    });

    test('closes the session where the agent can', async () => {
        const run = probe(agent({ closeSession: true }));
        await run.reading;
        expect(run.methods()).toEqual(['initialize', 'session/new', 'session/close']);
    });

    test('reads "authentication required" as signed out and never starts a login', async () => {
        const run = probe(agent({ authMethod: 'oauth' }));
        expect(await run.reading).toEqual({ signedIn: false, email: null, plan: null, organization: null });
        expect(run.methods()).not.toContain('authenticate');
        expect(existsSync(run.folders[0]!)).toBe(false);
    });

    test('fails on an agent that exits', async () => {
        const run = probe((io) => ({
            onLine: () => {
                io.err('no config');
                io.exit(1);
            }
        }));

        await expect(run.reading).rejects.toThrow('initialize failed: Fake exited');
        expect(existsSync(run.folders[0]!)).toBe(false);
    });

    test('fails on an agent that does not answer in time, and ends it', async () => {
        const clock = new ManualClock();
        const run = probe(() => ({ onLine: () => undefined }), { timer: clock });
        await run.firstFrame;
        clock.advance(ASK_TIMEOUT_MS);
        await expect(run.reading).rejects.toThrow('Fake did not answer in time');
        expect(await run.fake.started[0]!.exited).toBeNull();
        expect(existsSync(run.folders[0]!)).toBe(false);
    });
});
