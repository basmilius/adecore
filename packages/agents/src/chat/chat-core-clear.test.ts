import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChatInfo } from '@adecore/agent-contracts';
import { AgentHost } from '../host/agent-host.ts';
import { fakeClaude } from '../testing/fake-claude.ts';
import { inProcess } from '../testing/fake-cli.ts';

test('a Claude /clear moves the chat to the new conversation, with an empty context and no goal, and a resume takes it up', async () => {
    const home = await mkdtemp(join(tmpdir(), 'adecore-clear-'));
    const claude = inProcess(fakeClaude);
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
    const info = (): ChatInfo => chats.get('chat')!.info;

    // Looked at after every chat event; no clock is involved.
    const until = (done: (info: ChatInfo) => boolean): Promise<void> =>
        new Promise((resolve) => {
            const look = (): void => {
                if (done(info())) {
                    resolve();
                } else {
                    waiting.push(look);
                }
            };

            look();
        });

    const turn = async (text: string, done: (info: ChatInfo) => boolean = () => true): Promise<void> => {
        await chats.send('chat', text);
        await until((current) => current.activeTurnId === null && (current.queue ?? []).length === 0 && done(current));
    };

    try {
        await chats.create({ chatId: 'chat', provider: 'claude', cwd: home });
        await turn('/goal ship it');
        await turn('hello');
        const before = info();
        expect(before.goal).toMatchObject({ objective: 'ship it' });
        expect(before.usage.contextTokens).toBeGreaterThan(0);

        await turn('/clear', (current) => current.agentSessionId !== before.agentSessionId);
        const after = info();
        expect(after.usage.contextTokens).toBe(0);
        expect(after.goal ?? null).toBeNull();

        await chats.restart('chat');
        await turn('again');
        expect(claude.started.at(-1)!.argv).toContain(`--resume=${after.agentSessionId}`);
    } finally {
        await host.close();
        await rm(home, { recursive: true, force: true });
    }
});
