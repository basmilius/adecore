import { expect, spyOn, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChatInfo, ChatItem } from '@adecore/agent-contracts';
import { AgentHost } from '../host/agent-host.ts';
import { ProviderRegistry } from '../providers/registry.ts';
import { claudeStoppingOnResume, fakeClaude } from '../testing/fake-claude.ts';
import { inProcess, type FakeCli } from '../testing/fake-cli.ts';
import { claudeProvider } from '../testing/providers.ts';
import { AttachmentStore } from './attachment-store.ts';
import { ChatCore } from './chat-core.ts';
import { ChatLog } from './chat-log.ts';
import { ChatStore } from './chat-store.ts';

const providers = new ProviderRegistry({
    detect: async () => ({ installed: true, version: 'test' }),
    providers: [
        {
            ...claudeProvider,
            createBackend: () => ({
                running: true,
                pid: null,
                start: async () => undefined,
                sendTurn: () => undefined,
                compact: () => undefined,
                interrupt: () => undefined,
                respondApproval: () => false,
                respondQuestion: () => false,
                stop: () => undefined,
                dispose: async () => undefined
            })
        }
    ]
});

function info(chatId: string, cwd: string, patch: Partial<ChatInfo> = {}): ChatInfo {
    return {
        chatId,
        provider: 'claude',
        cwd,
        agentSessionId: null,
        model: null,
        selection: { model: 'claude-sonnet-5', options: {} },
        runtimeMode: 'full-access',
        status: 'idle',
        running: false,
        activeTurnId: null,
        slashCommands: [],
        usage: { contextTokens: 0, contextWindow: null, costUsd: 0, turns: 0 },
        createdAt: 0,
        ...patch
    };
}

function runningTurn(id: string): ChatItem {
    return { id, kind: 'turn', createdAt: 1, turnId: id, state: 'running', origin: 'user', endedAt: null, costUsd: 0 };
}

test('a start reads in full only the chats whose turn was running, also when only the log says so', async () => {
    const home = await mkdtemp(join(tmpdir(), 'adecore-recover-'));
    const store = new ChatStore(home);
    await store.write('idle', info('idle', home), [{ id: 'u1', kind: 'user', createdAt: 1, turnId: null, text: 'hi' }]);
    await store.write('busy', info('busy', home, { status: 'running', activeTurnId: 't1' }), [runningTurn('t1')]);
    // The host went down after the turn started and before a snapshot held it.
    await store.write('logged', info('logged', home), [], { seq: 0, resetSeq: 0 });
    const log = new ChatLog(store.logPath('logged'), { seq: 0, resetSeq: 0, lines: [] });
    log.append({ type: 'item', item: runningTurn('t2') }, 1);
    log.append({ type: 'info', info: info('logged', home, { status: 'running', activeTurnId: 't2' }) }, 1);
    log.close();

    const read = spyOn(store, 'read');
    const manager = new ChatCore({ attachments: new AttachmentStore(home), store, providers });

    try {
        await manager.recoverInterrupted();
        expect(new Set(read.mock.calls.map(([chatId]) => chatId))).toEqual(new Set(['busy', 'logged']));
        expect(manager.get('idle')).toBeUndefined();
        expect(manager.get('busy')).toBeDefined();
        expect(manager.get('logged')).toBeDefined();
    } finally {
        await manager.shutdown();
        await rm(home, { recursive: true, force: true });
    }
});

test('a start loads an idle chat that ran commands in the background and tells the host what it lost', async () => {
    const home = await mkdtemp(join(tmpdir(), 'adecore-recover-'));
    const store = new ChatStore(home);
    const background = [{ id: 'b1', kind: 'shell' as const, description: 'Watch CI', command: 'gh run watch 42 --exit-status', startedAt: 1 }];
    await store.write('watching', info('watching', home, { background }), [{ id: 'u1', kind: 'user', createdAt: 1, turnId: 't1', text: 'watch the run' }]);
    const told: Array<{ chatId: string; noteId: string; commands: string[] }> = [];

    const manager = new ChatCore({
        attachments: new AttachmentStore(home),
        store,
        providers,
        hooks: {
            lostWork: async (chatId, lost) => {
                told.push({ chatId, noteId: lost.noteId, commands: lost.commands.map((command) => command.command ?? '') });
            }
        }
    });

    try {
        await manager.recoverInterrupted();
        const chat = manager.get('watching')!;
        expect(told).toEqual([{ chatId: 'watching', noteId: 'lost:b1', commands: ['gh run watch 42 --exit-status'] }]);
        expect(chat.info.background).toEqual([]);
        expect(chat.thread.get('lost:b1')).toMatchObject({ kind: 'note', text: expect.stringContaining('"gh run watch 42 --exit-status"') });
        expect(chat.owesRestartWake('lost:b1')).toBe(true);
    } finally {
        await manager.shutdown();
        await rm(home, { recursive: true, force: true });
    }
});

test('a host that throws on hearing the lost work still gets the chat loaded and opened', async () => {
    const home = await mkdtemp(join(tmpdir(), 'adecore-recover-'));
    const store = new ChatStore(home);
    const background = [{ id: 'b1', kind: 'shell' as const, description: '', command: 'gh run watch', startedAt: 1 }];
    await store.write('watching', info('watching', home, { background }), []);
    const opened: string[] = [];
    const logged = spyOn(console, 'error').mockImplementation(() => {});

    const manager = new ChatCore({
        attachments: new AttachmentStore(home),
        store,
        providers,
        hooks: {
            lostWork: () => {
                throw new Error('the host is down');
            },
            opened: async (session) => {
                opened.push(session.id);
            }
        }
    });

    try {
        await manager.recoverInterrupted();
        expect(opened).toEqual(['watching']);
        expect(manager.get('watching')?.thread.get('lost:b1')).toBeDefined();
        expect(logged).toHaveBeenCalled();
    } finally {
        logged.mockRestore();
        await manager.shutdown();
        await rm(home, { recursive: true, force: true });
    }
});

/* A CLI wrapper that refuses a resume of `sessionIds` with only the line on stderr and exit 1, before any frame. */
function stderrOnResume(sessionIds: ReadonlySet<string>): FakeCli {
    return (io) => {
        const resume = io.argv.find((arg) => arg.startsWith('--resume='))?.slice('--resume='.length);

        if (resume === undefined || !sessionIds.has(resume)) {
            return fakeClaude(io);
        }

        io.err(`No conversation found with session ID: ${resume}\n`);
        io.exit(1);

        return { onLine: () => undefined };
    };
}

test.each([
    ['an error result and stderr', (gone: ReadonlySet<string>) => claudeStoppingOnResume(gone, 'missing')],
    ['stderr alone', stderrOnResume]
])(
    'a Claude conversation gone on resume (%s) fails that send with a note, and the next send starts a new session that hears the thread',
    async (_shape, cli) => {
        const home = await mkdtemp(join(tmpdir(), 'adecore-recover-'));
        const gone = new Set<string>();
        const claude = inProcess(cli(gone));
        const host = await AgentHost.open({
            dataDir: home,
            env: { HOME: home, PATH: process.env.PATH },
            background: false,
            command: ['claude'],
            spawn: claude.spawn
        });
        const chats = host.chats;
        const waiting: Array<() => void> = [];
        chats.observe(() => queueMicrotask(() => waiting.splice(0).forEach((look) => look())));
        const settled = (): boolean => chats.get('chat')?.info.activeTurnId === null && (chats.get('chat')?.info.queue ?? []).length === 0;
        // Looked at after every chat event; no clock is involved.
        const untilSettled = (): Promise<void> =>
            new Promise((resolve) => {
                const look = (): void => {
                    if (settled()) {
                        resolve();
                    } else {
                        waiting.push(look);
                    }
                };
                look();
            });
        const turn = async (text: string): Promise<void> => {
            await chats.send('chat', text);
            await untilSettled();
        };

        try {
            await chats.create({ chatId: 'chat', provider: 'claude', cwd: home });
            await turn('the lexer reads tabs wrong');
            const sessionId = chats.get('chat')!.info.agentSessionId!;
            // The CLI's store loses the conversation, as an ephemeral home does on a new machine.
            gone.add(sessionId);
            await chats.restart('chat');

            await turn('fix it');
            const failed = chats.get('chat')!;
            expect(claude.started.at(-1)!.argv).toContain(`--resume=${sessionId}`);
            expect(
                failed.thread
                    .list()
                    .filter((item) => item.kind === 'turn')
                    .map((item) => item.kind === 'turn' && item.state)
            ).toEqual(['done', 'error']);
            expect(failed.thread.list().some((item) => item.kind === 'note' && item.text.includes('could not resume this conversation'))).toBe(true);
            expect(failed.info.agentSessionId).toBeNull();
            const launches = claude.started.length;

            await turn('fix it, please');
            const fresh = claude.started.at(-1)!;
            expect(claude.started).toHaveLength(launches + 1);
            expect(fresh.argv.some((arg) => arg.startsWith('--resume'))).toBe(false);
            const reply = chats
                .get('chat')!
                .thread.list()
                .findLast((item) => item.kind === 'assistant');
            expect(reply?.kind === 'assistant' ? reply.text : '').toContain('the lexer reads tabs wrong');
            expect(reply?.kind === 'assistant' ? reply.text : '').toEndWith('fix it, please');
            // The failed send went out once and was never resent by itself.
            expect(
                chats
                    .get('chat')!
                    .thread.list()
                    .filter((item) => item.kind === 'user' && item.text === 'fix it')
            ).toHaveLength(1);
            expect(claude.started.filter((cli) => cli.argv.includes(`--resume=${sessionId}`))).toHaveLength(1);
            expect(chats.get('chat')!.info.agentSessionId).not.toBe(sessionId);
        } finally {
            await host.close();
            await rm(home, { recursive: true, force: true });
        }
    }
);
