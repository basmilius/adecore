import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { ChatEventSchema, type ChatInfo, type ChatItem } from '@adecore/agent-contracts';
import type { AgentEvent } from '../events.ts';
import { createAcpProvider } from '../providers/acp-provider.ts';
import { ModelCatalog } from '../providers/catalog.ts';
import { ProviderRegistry } from '../providers/registry.ts';
import { UsageScanner } from '../usage/scanner.ts';
import { fakeAcpCapture } from '../testing/fake-acp-capture.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { AttachmentStore } from './attachment-store.ts';
import { ChatCore } from './chat-core.ts';
import { ChatStore } from './chat-store.ts';
import capture from './fixtures/copilot-1.0.101-turn.json';

let home: string;
let core: ChatCore | null;

beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'adecore-acp-copilot-'));
    core = null;
});

afterEach(async () => {
    await core?.shutdown();
    await rm(home, { recursive: true, force: true });
});

/* The provider as a host offers Copilot: the agent picks its own model until it reported its own, and no account check ever runs. */
function copilot(options: { usageLog?: string } = {}) {
    const catalog = new ModelCatalog({
        defaultModel: 'default',
        profiles: { agent: { options: [], contextWindowTokens: {} } },
        models: [{ slug: 'default', name: 'Default', profile: 'agent' }]
    });

    return createAcpProvider({
        kind: 'copilot',
        name: 'GitHub Copilot',
        command: 'copilot',
        args: ['--acp', '--stdio'],
        catalog,
        model: (selection) => (selection.model === 'default' ? null : selection.model),
        modes: { supervised: ['https://agentclientprotocol.com/protocol/session-modes#agent'] },
        accountProbe: false,
        ...options
    });
}

// What a host tells every chat first; Copilot names a session after the start of its first prompt, these words included.
const INSTRUCTIONS = 'You work in a workspace of projects and views, and a shell command lets you read and change them on behalf of the person.';

function open(provider: ReturnType<typeof copilot>) {
    const fake = inProcess(fakeAcpCapture(capture));
    const providers = new ProviderRegistry({ detect: async () => ({ installed: true, version: '1.0.101' }), providers: [provider] });

    const chats = new ChatCore({
        providers,
        store: new ChatStore(home),
        attachments: new AttachmentStore(home),
        env: { HOME: home },
        spawn: fake.spawn,
        instructions: INSTRUCTIONS
    });

    core = chats;
    let info: ChatInfo | null = null;
    const items = new Map<string, ChatItem>();
    // What a client would refuse, and so never see: an info it refuses leaves it showing the turn as running.
    const refused: string[] = [];
    const waiters: Array<() => void> = [];

    chats.observe((event: AgentEvent) => {
        if (event.event === 'chat.event') {
            const chatEvent = event.payload.event;
            const parsed = ChatEventSchema.safeParse(chatEvent);

            if (!parsed.success) {
                refused.push(parsed.error.issues.map((issue) => issue.path.join('.')).join(', '));
            }

            if (chatEvent.type === 'info') {
                info = chatEvent.info;
            } else if (chatEvent.type === 'item') {
                items.set(chatEvent.item.id, chatEvent.item);
            }
        }

        for (const wake of waiters.splice(0)) {
            wake();
        }
    });

    const until = async (done: () => boolean): Promise<void> => {
        while (!done()) {
            await new Promise<void>((resolve) => waiters.push(resolve));
        }
    };

    const turns = () => [...items.values()].filter((item) => item.kind === 'turn');

    return { chats, fake, until, turns, refused, info: () => info, items: () => [...items.values()] };
}

test('ends a Copilot turn on its response in what a client reads, and sends the message queued behind it', async () => {
    const chat = open(copilot());
    await chat.chats.create({ chatId: 'copilot', cwd: home, provider: 'copilot' });
    await chat.chats.send('copilot', 'Reply with the single word ok.');
    const queued = await chat.chats.send('copilot', 'And once more.');
    expect(queued.queued).toBe(true);
    await chat.until(() => chat.turns().filter((turn) => turn.kind === 'turn' && turn.state === 'done').length === 2 && chat.info()?.activeTurnId === null);
    expect(chat.refused).toEqual([]);
    expect(chat.items().flatMap((item) => (item.kind === 'assistant' ? [item.text] : []))).toEqual(['ok', 'ok']);
    expect(chat.info()).toMatchObject({ status: 'idle', usage: { contextTokens: 19780, contextWindow: 128000, turns: 2 } });
    // Copilot's title is the start of the prompt, instructions and all, which names nothing.
    expect(chat.info()?.suggestedTitle).toBeUndefined();
});

test("adopts Copilot's models and reasoning effort from a chat's session, its effort names written with a capital, with no account check", async () => {
    const provider = copilot();
    expect(provider.askAccount).toBeUndefined();
    const chat = open(provider);
    await chat.chats.create({ chatId: 'copilot', cwd: home, provider: 'copilot' });
    await chat.chats.send('copilot', 'Reply with the single word ok.');
    await chat.until(() => chat.turns().some((turn) => turn.kind === 'turn' && turn.state === 'done'));
    expect(provider.catalog.defaultModel).toBe('claude-sonnet-4.6');
    expect(provider.catalog.list().map((model) => [model.slug, model.name])).toEqual([
        ['auto', 'Auto'],
        ['claude-sonnet-4.6', 'Claude Sonnet 4.6'],
        ['claude-haiku-4.5', 'Claude Haiku 4.5'],
        ['gpt-5.3-codex', 'GPT-5.3-Codex'],
        ['mai-code-1.1-flash', 'MAI-Code-1.1-Flash']
    ]);

    const haiku = provider.catalog.list().find((model) => model.slug === 'claude-haiku-4.5');

    expect(haiku?.options.find((option) => option.id === 'effort')).toMatchObject({
        type: 'select',
        defaultChoice: 'medium',
        choices: [
            { id: 'low', label: 'Low' },
            { id: 'medium', label: 'Medium' },
            { id: 'high', label: 'High' },
            { id: 'max', label: 'Max' }
        ]
    });
    expect(provider.capabilities).toMatchObject({ reportsContextWindow: true, compaction: 'prompt' });
});

test("logs a Copilot turn's tokens with their kinds apart, for the usage page", async () => {
    const folder = join(home, 'copilot-usage');
    const chat = open(copilot({ usageLog: folder }));
    await chat.chats.create({ chatId: 'copilot', cwd: home, provider: 'copilot' });
    await chat.chats.send('copilot', 'Reply with the single word ok.');
    await chat.until(() => chat.turns().some((turn) => turn.kind === 'turn' && turn.state === 'done'));
    const scanner = new UsageScanner(join(home, 'scan'), [{ provider: 'copilot', path: folder }]);
    await scanner.scan();

    // Input, output and both cache kinds add up to more than the total, so the input held the cache.
    expect(scanner.records()).toMatchObject([
        { provider: 'copilot', model: 'claude-sonnet-4.6', totals: { calls: 1, input: 10, cacheRead: 8167, cacheWrite: 14768, output: 42, reasoning: 35 } }
    ]);
});
