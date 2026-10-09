import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { evaluateUiBlock } from '@adecore/intelligent-ui';
import type { ChatEventEnvelope } from '@adecore/agent-contracts';
import type { BackendHost } from './backend.ts';
import { ChatCore } from './chat-core.ts';
import { ChatStore } from './chat-store.ts';
import { AttachmentStore } from './attachment-store.ts';
import { claudeProvider } from '../providers/claude-provider.ts';
import { ProviderRegistry } from '../providers/registry.ts';
import { parseLog } from './chat-log.ts';

test('UI previews reach attached clients without a log sequence or observer side effects and reconnect without logging', async () => {
    const home = await mkdtemp(join(tmpdir(), 'adecore-ui-log-'));
    let host: BackendHost | undefined;
    const attachments = new AttachmentStore(home);
    const store = new ChatStore(home, { attachments });
    const manager = new ChatCore({
        attachments,
        store,
        providers: new ProviderRegistry({
            detect: async () => ({ installed: true, version: 'test' }),
            providers: [
                {
                    ...claudeProvider,
                    createBackend: (_launch, backendHost) => {
                        host = backendHost;
                        return {
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
                        };
                    }
                }
            ]
        })
    });
    const clients: ChatEventEnvelope[] = [];
    const observers: ChatEventEnvelope[] = [];
    manager.subscribe('client', (event) => {
        if (event.event === 'chat.event') {
            clients.push(event.payload);
        }
    });
    manager.observe((event) => {
        if (event.event === 'chat.event') {
            observers.push(event.payload);
        }
    });
    try {
        await manager.create({ chatId: 'chat', cwd: home });
        manager.attach('chat', 'client');
        await manager.send('chat', 'Show results');
        for (let i = 0; i < 12; i++) {
            await Promise.resolve();
        }
        expect(host).toBeDefined();
        if (!host) {
            throw new Error('Missing backend host');
        }
        const text = '```ui\n<Summary>Streaming';
        host.onEvent({ type: 'text.delta', ref: 'answer', text });
        const preview = clients.find((payload) => payload.event.type === 'delta' && payload.event.ui !== undefined);
        expect(preview).toBeDefined();
        expect(preview?.seq).toBeUndefined();
        expect(observers.some((payload) => payload.event.type === 'delta' && payload.event.ui !== undefined)).toBe(false);
        const snapshot = manager.attach('chat', 'fresh');
        expect(snapshot.items.find((item) => item.kind === 'assistant')).toHaveProperty('ui');
        const replay = manager.attach('chat', 'resumed', undefined, snapshot.seq);
        expect(replay.seq).toBe(snapshot.seq);
        expect(replay.events?.some((event) => event.type === 'delta' && event.ui !== undefined)).toBe(true);
        const lines = parseLog(await readFile(store.logPath('chat'), 'utf8'));
        expect(lines.some((line) => line.event.type === 'delta' && line.event.ui !== undefined)).toBe(false);
        const authoritative = '```ui\n<Summary>Final</Summary><Choices><Choice context="Run checks">Check</Choice></Choices>\n```';
        host.onEvent({ type: 'text.done', ref: 'answer', text: authoritative, parentRef: null });
        const finalLines = parseLog(await readFile(store.logPath('chat'), 'utf8'));
        expect(
            finalLines.filter((line) => line.event.type === 'item' && line.event.item.kind === 'assistant' && line.event.item.ui !== undefined)
        ).toHaveLength(1);
        expect(finalLines.some((line) => line.event.type === 'delta' && line.event.ui !== undefined)).toBe(false);
        const assistant = manager
            .get('chat')!
            .thread.list()
            .find((item) => item.kind === 'assistant')!;
        if (assistant.kind !== 'assistant' || !assistant.ui?.[0]) {
            throw new Error('Missing completed UI block');
        }
        const block = assistant.ui[0];
        expect(block.revision).toMatch(/^[a-f0-9]{64}$/);
        const choice = evaluateUiBlock(block).nodes.find((node) => node.type === 'Choices')!.children[0];
        const payload = { chatId: 'chat', itemId: assistant.id, blockId: block.id, revision: block.revision!, choiceId: choice.id };
        const [first, repeated] = await Promise.all([manager.choose(payload), manager.choose(payload)]);
        expect(repeated).toEqual(first);
        expect(first.queued).toBe(true);
        const stored = await store.read('chat');
        expect(stored?.info.queue).toHaveLength(1);
        expect(stored?.info.queue?.[0]).toMatchObject({ text: 'Run checks', uiChoice: { label: 'Check', revision: block.revision } });
        expect(stored?.items.find((item) => item.id === assistant.id)).toMatchObject({
            uiAnswers: { [block.id]: { choiceId: choice.id, turnId: first.turnId, queued: true } }
        });
    } finally {
        await manager.shutdown();
        for (const info of manager.list()) {
            await manager.get(info.chatId)?.dispose();
        }
        await rm(home, { recursive: true, force: true });
    }
});
