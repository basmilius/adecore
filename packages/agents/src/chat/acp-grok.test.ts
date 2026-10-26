import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import type { ChatInfo } from '@adecore/agent-contracts';
import type { AgentEvent } from '../events.ts';
import { createAcpProvider } from '../providers/acp-provider.ts';
import { ModelCatalog } from '../providers/catalog.ts';
import { ProviderRegistry } from '../providers/registry.ts';
import { fakeAcpCapture, type AcpCapture } from '../testing/fake-acp-capture.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { AttachmentStore } from './attachment-store.ts';
import { ChatCore } from './chat-core.ts';
import { ChatStore } from './chat-store.ts';
import capture from './fixtures/grok-1.0.62-usage.json';

let home: string;
let core: ChatCore | null;

beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'adecore-acp-grok-'));
    core = null;
});

afterEach(async () => {
    await core?.shutdown();
    await rm(home, { recursive: true, force: true });
});

test("fills the context meter from Grok's own count of the context, against the window its model names", async () => {
    const catalog = new ModelCatalog({
        defaultModel: 'grok-4.7',
        profiles: { agent: { options: [], contextWindowTokens: {} } },
        models: [{ slug: 'grok-4.7', name: 'Grok 4.7', profile: 'agent' }]
    });

    const provider = createAcpProvider({
        kind: 'grok',
        name: 'Grok',
        command: 'grok',
        args: ['agent', 'stdio'],
        catalog,
        modes: { supervised: ['default'] },
        accountProbe: false
    });

    const fake = inProcess(fakeAcpCapture(capture as AcpCapture));
    const providers = new ProviderRegistry({ detect: async () => ({ installed: true, version: '1.0.62' }), providers: [provider] });
    const chats = new ChatCore({ providers, store: new ChatStore(home), attachments: new AttachmentStore(home), env: { HOME: home }, spawn: fake.spawn });
    core = chats;
    const infos = new Map<string, ChatInfo>();
    const waiters: Array<() => void> = [];

    chats.observe((event: AgentEvent) => {
        if (event.event === 'chat.event' && event.payload.event.type === 'info') {
            infos.set(event.payload.chatId, event.payload.event.info);
        }

        for (const wake of waiters.splice(0)) {
            wake();
        }
    });

    const turn = async (chatId: string): Promise<ChatInfo> => {
        await chats.create({ chatId, cwd: home, provider: 'grok' });
        await chats.send(chatId, 'Reply with the single word ok.');

        while (infos.get(chatId)?.usage.turns !== 1 || infos.get(chatId)?.activeTurnId !== null) {
            await new Promise<void>((resolve) => waiters.push(resolve));
        }

        return infos.get(chatId)!;
    };

    // The window comes from the session that reported the models, after the chat began without one.
    expect(await turn('grok')).toMatchObject({ selection: { model: 'grok-4.7' }, usage: { contextTokens: 21939, contextWindow: 256000 } });
});
