import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProviderAccountMap } from '@adecore/agent-contracts';
import { codexProvider } from '../providers/codex-provider.ts';
import { ProviderRegistry } from '../providers/registry.ts';
import { testAccounts } from '../testing/accounts.ts';
import { AttachmentStore } from './attachment-store.ts';
import type { BackendHost } from './backend.ts';
import { ChatCore } from './chat-core.ts';
import { ChatStore } from './chat-store.ts';
import type { ChatTitleInput } from './chat-title.ts';

let root: string;
let home: string;
let core: ChatCore | null;
let host: BackendHost | null;

const providers = new ProviderRegistry({
    detect: async () => ({ installed: true, version: 'test' }),
    providers: [
        {
            ...codexProvider,
            createBackend: (_launch, made) => {
                host = made;

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
});

beforeEach(() => {
    root = '';
    core = null;
    host = null;
});

afterEach(async () => {
    await core?.shutdown();
    await rm(root, { recursive: true, force: true });
});

// A first turn that went well on a chat of the given account; answers what the host's `nameChat` was asked.
async function nameFirstTurn(account: string | undefined): Promise<{ kind: string; input: ChatTitleInput }[]> {
    root = await mkdtemp(join(tmpdir(), 'adecore-core-title-'));
    home = join(root, 'home');
    const accounts: ProviderAccountMap = {
        codex_work: { kind: 'codex', label: 'Work', home: join(root, 'work'), env: [{ name: 'REVIEW_ACCOUNT', value: 'work-account', sensitive: false }] }
    };
    const service = await testAccounts({ home: root, env: { HOME: home, USERPROFILE: home }, accounts, folders: new Set([join(root, 'work')]) });
    const asked: { kind: string; input: ChatTitleInput }[] = [];

    core = new ChatCore({
        providers,
        store: new ChatStore(root),
        attachments: new AttachmentStore(root),
        env: { HOME: home, PATH: '/bin' },
        accounts: service,
        nameChat: async (kind, input) => {
            asked.push({ kind, input });

            return 'A title';
        }
    });

    await core.create({ chatId: 'chat', provider: 'codex', cwd: home, ...(account === undefined ? {} : { account }) });
    await core.send('chat', 'Explain a tree.');
    host!.onEvent({ type: 'turn.done', state: 'done', costUsd: 0 });
    await new Promise<void>((resolve) => setImmediate(resolve));

    return asked;
}

describe('the name ChatCore asks its host for', () => {
    test('a chat on an extra account asks under that account and its environment, the one its own CLI runs with', async () => {
        const asked = await nameFirstTurn('codex_work');

        expect(asked).toHaveLength(1);
        expect(asked[0]?.input.account).toBe('codex_work');
        expect(asked[0]?.input.env?.REVIEW_ACCOUNT).toBe('work-account');
    });

    test('a chat on the default account asks with no account, and the environment of the default account', async () => {
        const asked = await nameFirstTurn(undefined);

        expect(asked).toHaveLength(1);
        expect(asked[0]?.input.account).toBeUndefined();
        expect(asked[0]?.input.env?.REVIEW_ACCOUNT).toBeUndefined();
    });
});
