import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import type { AgentKind, ChatInfo, ChatItem } from '@adecore/agent-contracts';
import type { AgentEvent } from '../events.ts';
import { createAcpProvider, type AcpProviderSpec } from '../providers/acp-provider.ts';
import { ModelCatalog } from '../providers/catalog.ts';
import { ProviderRegistry } from '../providers/registry.ts';
import { fakeAcpCapture, type AcpCapture } from '../testing/fake-acp-capture.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { AttachmentStore } from './attachment-store.ts';
import { ChatCore } from './chat-core.ts';
import { ChatStore } from './chat-store.ts';
import copilotCapture from './fixtures/copilot-1.0.101-denied.json';
import grokCapture from './fixtures/grok-1.0.62-denied.json';

let home: string;
let core: ChatCore | null;
let opened = 0;

beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'adecore-acp-denied-'));
    core = null;
});

afterEach(async () => {
    await core?.shutdown();
    await rm(home, { recursive: true, force: true });
});

const AGENTS = {
    grok: { name: 'Grok', command: 'grok', modes: { supervised: ['default'] }, version: '1.0.62', capture: grokCapture },
    copilot: {
        name: 'GitHub Copilot',
        command: 'copilot',
        modes: { supervised: ['https://agentclientprotocol.com/protocol/session-modes#agent'] },
        version: '1.0.101',
        capture: copilotCapture
    }
} as const;

/* A chat in supervised mode on a recorded turn whose one permission request is denied; `answers` holds what the agent was told. */
function open(kind: keyof typeof AGENTS, options: Partial<AcpProviderSpec> = {}) {
    const agent = AGENTS[kind];

    const catalog = new ModelCatalog({
        defaultModel: 'default',
        profiles: { agent: { options: [], contextWindowTokens: {} } },
        models: [{ slug: 'default', name: 'Default', profile: 'agent' }]
    });

    const provider = createAcpProvider({
        kind: kind as AgentKind,
        name: agent.name,
        command: agent.command,
        catalog,
        model: (selection) => (selection.model === 'default' ? null : selection.model),
        modes: agent.modes,
        accountProbe: false,
        ...options
    });

    const answers: unknown[] = [];
    const fake = inProcess(fakeAcpCapture(agent.capture as AcpCapture, answers));
    const providers = new ProviderRegistry({ detect: async () => ({ installed: true, version: agent.version }), providers: [provider] });
    const chats = new ChatCore({ providers, store: new ChatStore(home), attachments: new AttachmentStore(home), env: { HOME: home }, spawn: fake.spawn });
    core = chats;
    let info: ChatInfo | null = null;
    const items = new Map<string, ChatItem>();
    const waiters: Array<() => void> = [];

    chats.observe((event: AgentEvent) => {
        if (event.event === 'chat.event') {
            const chatEvent = event.payload.event;

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

    const list = () => [...items.values()];

    const chatId = `${kind}-${++opened}`;

    const run = async (): Promise<void> => {
        await chats.create({ chatId, cwd: home, provider: kind, runtimeMode: 'supervised' });
        await chats.send(chatId, 'Create probe.txt.');
        await until(() => list().some((item) => item.kind === 'approval' && item.decision === 'pending'));
        const approval = list().find((item) => item.kind === 'approval');
        chats.approve(chatId, approval?.kind === 'approval' ? approval.requestId : '', 'deny');
        await until(() => info?.activeTurnId === null && list().some((item) => item.kind === 'turn' && item.state !== 'running'));
    };

    return { run, answers, info: () => info, items: list };
}

function tools(items: ChatItem[]) {
    return items.flatMap((item) => (item.kind === 'tool' ? [{ name: item.name, state: item.state, changes: item.changes }] : []));
}

test('a Grok turn that ends on a denied call ends as done, with the text it streamed before the call', async () => {
    const chat = open('grok');
    await chat.run();
    expect(chat.answers).toEqual([{ outcome: { outcome: 'selected', optionId: 'reject-once' } }]);
    const items = chat.items();
    expect(items.filter((item) => item.kind === 'turn').map((item) => (item.kind === 'turn' ? item.state : null))).toEqual(['done']);
    expect(items.flatMap((item) => (item.kind === 'assistant' ? [item.text] : []))).toEqual(['Ik maak `probe.txt` aan.']);
    expect(items.flatMap((item) => (item.kind === 'approval' ? [item.decision] : []))).toEqual(['deny']);
    expect(tools(items)).toEqual([{ name: 'Change', state: 'error', changes: undefined }]);
});

test('a call Copilot was denied shows as a failed call without its diff, and its cancellation line stays out of the thread', async () => {
    const chat = open('copilot');
    await chat.run();
    expect(chat.answers).toEqual([{ outcome: { outcome: 'selected', optionId: 'reject_once' } }]);
    const items = chat.items();
    expect(items.filter((item) => item.kind === 'turn').map((item) => (item.kind === 'turn' ? item.state : null))).toEqual(['done']);
    expect(items.flatMap((item) => (item.kind === 'assistant' ? [item.text] : []))).toEqual(['I will create probe.txt in the current folder.']);
    expect(tools(items)).toEqual([{ name: 'Change', state: 'error', changes: undefined }]);
});

test("leaves naming the chat to the host and takes Grok's own session titles only when the spec asks", async () => {
    const plain = open('grok');
    await plain.run();
    expect(plain.info()?.suggestedTitle).toBeUndefined();
    await core?.shutdown();
    core = null;
    const adopting = open('grok', { adoptTitles: true });
    await adopting.run();
    expect(adopting.info()?.suggestedTitle).toBe('Create probe.txt containing word hi');
});
