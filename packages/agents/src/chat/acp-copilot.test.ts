import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatEventSchema, type ChatInfo, type ChatItem } from '@adecore/agent-contracts';
import type { AgentEvent } from '../events.ts';
import { createAcpProvider } from '../providers/acp-provider.ts';
import { ModelCatalog } from '../providers/catalog.ts';
import { ProviderRegistry } from '../providers/registry.ts';
import { fakeAcpCapture, type AcpCapture, type AcpPromptScript } from '../testing/fake-acp-capture.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { UsageScanner } from '../usage/scanner.ts';
import { AttachmentStore } from './attachment-store.ts';
import { ChatCore } from './chat-core.ts';
import { ChatStore } from './chat-store.ts';
import capture from './fixtures/copilot-1.0.101-turn.json';
import heldPrompt from './fixtures/copilot-1.0.110-held-prompt.json';
import wake from './fixtures/copilot-1.0.112-wake.json';

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

function open(provider: ReturnType<typeof copilot>, scenario: AcpCapture = capture) {
    const received: Array<Record<string, unknown>> = [];
    const fake = inProcess(fakeAcpCapture(scenario, [], received));
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
    // Every info and item in the order a client read them.
    const log: Array<ChatInfo | ChatItem> = [];
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
                log.push(chatEvent.info);
            } else if (chatEvent.type === 'item') {
                items.set(chatEvent.item.id, chatEvent.item);
                log.push(chatEvent.item);
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

    return { chats, fake, until, turns, refused, received, log, info: () => info, items: () => [...items.values()] };
}

// A scenario derived from t3code, played over the recorded handshake.
function derived(scenario: { prompts: AcpPromptScript[] }): AcpCapture {
    return { ...capture, prompts: scenario.prompts };
}

function texts(chat: ReturnType<typeof open>): string[] {
    return chat.items().flatMap((item) => (item.kind === 'assistant' ? [item.text] : []));
}

// Where in what a client read the first entry that passes, -1 for none.
function firstIn(chat: ReturnType<typeof open>, passes: (entry: ChatInfo | ChatItem) => boolean): number {
    return chat.log.findIndex(passes);
}

const isInfo = (entry: ChatInfo | ChatItem): entry is ChatInfo => !('kind' in entry);

test("opts into Copilot's foreground events, ends its turn on the root idle while a shell holds the response, and lets the old prompt close no newer turn", async () => {
    const chat = open(copilot(), derived(heldPrompt));
    await chat.chats.create({ chatId: 'copilot', cwd: home, provider: 'copilot' });
    await chat.chats.send('copilot', 'Run sleep 120 in the background and reply ok.');
    const queued = await chat.chats.send('copilot', 'Reply with: two');
    expect(queued.queued).toBe(true);

    await chat.until(
        () =>
            chat.turns().filter((turn) => turn.kind === 'turn' && turn.state === 'done').length === 2 &&
            chat.info()?.activeTurnId === null &&
            (chat.info()?.background ?? []).length === 0
    );

    expect(chat.refused).toEqual([]);

    expect(chat.received.find((frame) => frame.method === 'initialize')?.params).toMatchObject({
        clientCapabilities: { _meta: { 'github.com/copilot': { events: ['assistant.turn_start', 'assistant.idle'] } } }
    });

    // The queued message went out while the first response was still held, and neither its late response nor its idle took the second turn.
    expect(chat.received.filter((frame) => frame.method === 'session/prompt')).toHaveLength(2);
    expect(chat.turns()).toHaveLength(2);
    expect(texts(chat)).toEqual(['ok', 'two']);

    const shell = firstIn(chat, (entry) => isInfo(entry) && (entry.background ?? []).some((task) => task.kind === 'shell' && task.command === 'sleep 120'));
    const firstDone = firstIn(chat, (entry) => !isInfo(entry) && entry.kind === 'turn' && entry.state === 'done');
    expect(shell).toBeGreaterThan(-1);
    expect(shell).toBeLessThan(firstDone);
});

test("shows Copilot's reply to a wake once, in a turn of its own that ends on its own idle while the prompt's response is still held", async () => {
    const chat = open(copilot(), derived(wake));
    await chat.chats.create({ chatId: 'copilot', cwd: home, provider: 'copilot' });
    await chat.chats.send('copilot', 'Start a background agent and tell me when it is done.');
    await chat.until(
        () => chat.turns().filter((turn) => turn.kind === 'turn' && turn.state === 'done').length === 2 && (chat.info()?.background ?? []).length === 0
    );
    expect(chat.refused).toEqual([]);
    expect(texts(chat)).toEqual(['Agents are still working.', 'Agent 1 finished']);
    expect(chat.turns().map((turn) => (turn.kind === 'turn' ? (turn.origin ?? 'user') : null))).toEqual(['user', 'agent']);

    const wakeDone = firstIn(chat, (entry) => !isInfo(entry) && entry.kind === 'turn' && entry.origin === 'agent' && entry.state === 'done');
    const held = firstIn(chat, (entry) => isInfo(entry) && (entry.background ?? []).length > 0);
    const answered = chat.log.findLastIndex((entry) => isInfo(entry) && (entry.background ?? []).length === 0);
    expect(held).toBeGreaterThan(-1);
    expect(wakeDone).toBeLessThan(answered);
    expect(chat.info()).toMatchObject({ status: 'idle', activeTurnId: null });
});

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
