import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProviderAccountMap } from '@adecore/agent-contracts';
import { claudeProvider } from '../providers/claude-provider.ts';
import { ProviderRegistry } from '../providers/registry.ts';
import { testAccounts } from '../testing/accounts.ts';
import { AttachmentStore } from './attachment-store.ts';
import { ChatCore } from './chat-core.ts';
import { ChatStore } from './chat-store.ts';

let root: string;
let home: string;
let core: ChatCore | null;

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

async function open(accounts: ProviderAccountMap): Promise<ChatCore> {
    const service = await testAccounts({ home: root, env: { HOME: home, USERPROFILE: home }, accounts, folders: new Set([join(root, 'work')]) });

    core = new ChatCore({
        providers,
        store: new ChatStore(root),
        attachments: new AttachmentStore(root),
        env: { HOME: home, PATH: '/bin' },
        accounts: service
    });

    return core;
}

// A second account in a folder of its own, beside the default account; `defaultOn` false turns that one off.
function machine(defaultOn: boolean): ProviderAccountMap {
    const work = { claude_work: { kind: 'claude', label: 'Work', home: join(root, 'work') } };

    return defaultOn ? work : { claude: { kind: 'claude', enabled: false }, ...work };
}

async function refusalOf(work: () => unknown): Promise<unknown> {
    try {
        await work();
    } catch (e) {
        return e;
    }

    return null;
}

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'adecore-core-accounts-'));
    home = join(root, 'home');
    core = null;
});

afterEach(async () => {
    await core?.shutdown();
    await rm(root, { recursive: true, force: true });
});

describe('the account a chat of ChatCore starts under', () => {
    test('a new chat that names the turned-off default account is refused and never made, whatever the person picked before', async () => {
        const chats = await open(machine(false));
        chats.composerPreferences.set('client', { accounts: { claude: 'claude_work' }, changedAt: 1 });
        const refusal = await refusalOf(() => chats.create({ chatId: 'named', cwd: home, provider: 'claude', account: 'claude' }));
        expect(refusal).toMatchObject({ code: 'account-unavailable', message: expect.stringContaining('it is turned off') });
        expect(await chats.readChat('named')).toBeNull();
    });

    test('a new chat that names no account starts on the default account while nobody put another on top', async () => {
        const chats = await open(machine(true));
        const info = await chats.create({ chatId: 'unnamed', cwd: home, provider: 'claude' });
        expect(info.account).toBeUndefined();
    });

    test('a new chat that names no account starts on the top account that is on, whatever an older client picked', async () => {
        const chats = await open({ claude: { kind: 'claude', order: 1 }, claude_work: { kind: 'claude', label: 'Work', home: join(root, 'work'), order: 0 } });
        chats.composerPreferences.set('client', { accounts: { claude: 'claude' }, changedAt: 1 });
        const info = await chats.create({ chatId: 'ordered', cwd: home, provider: 'claude' });
        expect(info.account).toBe('claude_work');
    });

    test('a new chat that names no account passes over a turned-off default account to the next one', async () => {
        const chats = await open(machine(false));
        const info = await chats.create({ chatId: 'unnamed', cwd: home, provider: 'claude' });
        expect(info.account).toBe('claude_work');
    });

    test('the host can choose the account of a new chat, or refuse it', async () => {
        const service = await testAccounts({
            home: root,
            env: { HOME: home, USERPROFILE: home },
            accounts: machine(true),
            folders: new Set([join(root, 'work')])
        });
        const refusal = new Error('off in this project');

        core = new ChatCore({
            providers,
            store: new ChatStore(root),
            attachments: new AttachmentStore(root),
            env: { HOME: home, PATH: '/bin' },
            accounts: service,
            hooks: {
                openingAccount: (chatId, _kind, named) => {
                    if (named === 'claude') {
                        throw refusal;
                    }

                    return chatId === 'project' ? 'claude_work' : undefined;
                }
            }
        });

        expect((await core.create({ chatId: 'project', cwd: home, provider: 'claude' })).account).toBe('claude_work');
        expect((await core.create({ chatId: 'elsewhere', cwd: home, provider: 'claude' })).account).toBeUndefined();
        expect(await refusalOf(() => core?.create({ chatId: 'named', cwd: home, provider: 'claude', account: 'claude' }))).toBe(refusal);
    });

    test('a new chat that names the default account while it is on keeps no id for it', async () => {
        const chats = await open(machine(true));
        const info = await chats.create({ chatId: 'on', cwd: home, provider: 'claude', account: 'claude' });
        expect(info.account).toBeUndefined();
    });

    test('a switch to the turned-off default account is refused', async () => {
        const chats = await open(machine(false));
        await chats.create({ chatId: 'work', cwd: home, provider: 'claude', account: 'claude_work' });
        const refusal = await refusalOf(() => chats.configure({ chatId: 'work', account: 'claude' }));
        expect(refusal).toMatchObject({ code: 'account-unavailable', message: expect.stringContaining('it is turned off') });
        expect((await chats.readChat('work'))?.info.account).toBe('claude_work');
    });

    test('a chat on the default account has nothing to switch to it', async () => {
        const chats = await open(machine(true));
        await chats.create({ chatId: 'default', cwd: home, provider: 'claude' });
        expect(chats.configure({ chatId: 'default', account: 'claude' }).account).toBeUndefined();
    });

    test('a chat whose CLI holds the conversation keeps an account that cannot read it, until a clear starts it over', async () => {
        await new ChatStore(root).write(
            'spoke',
            {
                chatId: 'spoke',
                provider: 'claude',
                account: 'claude_work',
                cwd: home,
                agentSessionId: 'session-1',
                model: null,
                selection: { model: 'claude-sonnet-5', options: {} },
                runtimeMode: 'full-access',
                status: 'idle',
                running: false,
                activeTurnId: null,
                slashCommands: [],
                usage: { contextTokens: 0, contextWindow: null, costUsd: 0, turns: 3 },
                createdAt: 1
            },
            []
        );

        const chats = await open(machine(true));
        await chats.create({ chatId: 'spoke' });
        const refusal = await refusalOf(() => chats.configure({ chatId: 'spoke', account: 'claude' }));
        expect(refusal).toMatchObject({ code: 'account-incompatible' });
        await chats.clear('spoke');
        const info = chats.configure({ chatId: 'spoke', account: 'claude' });
        expect(info.account).toBeUndefined();
        expect(info.usage.turns).toBe(3);
    });
});
