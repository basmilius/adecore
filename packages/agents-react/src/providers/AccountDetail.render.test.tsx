import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { ProviderAccounts, ProviderInfo } from '@adecore/agent-contracts';
import { createPage } from '@adecore/editor/testing';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AccountEntry } from '../agents/accounts';
import { ChatHostProvider, type ChatHost } from '../host/host';
import { ChatScopeContext, type ChatScope } from '../scope';
import { useProviderAccountsStore } from '../state/provider-accounts';
import { ChatTransportError } from '../transport';
import { AccountDetail } from './AccountDetail';

const FROM_PAGE = ['window', 'document', 'Node', 'Element', 'HTMLElement', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const;
const NAMES = [...FROM_PAGE, 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT'] as const;

class StillResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

const claude = { kind: 'claude', name: 'Claude Code', installed: true, models: [], capabilities: { terminal: true } } as unknown as ProviderInfo;
const codex = { ...claude, kind: 'codex', name: 'Codex' } as ProviderInfo;

function entryOf(kind: string, id: string, extra: Partial<AccountEntry['account']> = {}): AccountEntry {
    return {
        id,
        account: { kind, label: 'Work', ...(id === kind ? {} : { home: `/home/${id}` }), ...extra },
        isDefault: id === kind,
        status: { id, kind, state: 'ready', email: null, plan: null, organization: null, home: `/home/${id}`, message: null, checkedAt: 1 }
    };
}

function snapshotOf(entry: AccountEntry, sharedConfigKinds?: string[]): ProviderAccounts {
    return {
        accounts: { [entry.id]: entry.account },
        statuses: entry.status === null ? [] : [entry.status],
        ...(sharedConfigKinds === undefined ? {} : { sharedConfigKinds })
    };
}

describe("AccountDetail sharing the default account's setup", () => {
    let page: ReturnType<typeof createPage>;
    let root: Root;
    let previous: (PropertyDescriptor | undefined)[];
    let requests: { type: string; payload: unknown }[];
    let notices: string[];
    let refuse: boolean;
    // A host is read once per provider, so every draw mounts a new one.
    let drawn = 0;

    const scope = {
        id: 'share-config-test',
        transport: {
            status: 'open',
            request: async (type: string, payload: unknown) => {
                requests.push({ type, payload });

                if (refuse) {
                    throw new ChatTransportError('invalid-account', 'The default account is the one the others share from');
                }

                return { accounts: {}, statuses: [] };
            },
            on: () => () => {},
            subscribeStatus: () => () => {}
        }
    } as unknown as ChatScope;

    const draw = async (provider: ProviderInfo, entry: AccountEntry, options: { kinds?: string[]; answers?: boolean } = {}): Promise<void> => {
        useProviderAccountsStore.getState().set(scope.id, snapshotOf(entry, options.kinds));

        const host: Partial<ChatHost> = {
            notify: (notice) => {
                notices.push(notice.title);

                return '';
            },
            useCanShareAccountConfig: () => options.answers !== false
        } as Partial<ChatHost>;

        await act(async () =>
            root.render(
                <ChatHostProvider key={drawn++} host={host}>
                    <ChatScopeContext.Provider value={scope}>
                        <AccountDetail
                            provider={provider}
                            entry={entry}
                            login="terminal"
                            canOpenLogin
                            loginBlocked={null}
                            secretsAvailable={false}
                            onRemoved={() => {}}
                        />
                    </ChatScopeContext.Provider>
                </ChatHostProvider>
            )
        );
    };

    const switchNamed = (): HTMLElement | null => page.host.querySelector('[role="switch"][aria-label="Use the setup of the default account"]');

    // This page does not flip the hidden checkbox of a click on the switch, so the test flips it and sends the click itself.
    const flip = async (checked: boolean): Promise<void> => {
        const input = switchNamed()?.nextElementSibling as HTMLInputElement;

        await act(async () => {
            input.checked = checked;
            input.dispatchEvent(new page.window.Event('click', { bubbles: true }));
        });
    };

    beforeEach(() => {
        page = createPage();
        previous = NAMES.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
        requests = [];
        notices = [];
        refuse = false;

        // A page without styles: every token and background reads as unset.
        page.window.getComputedStyle = () =>
            new Proxy(
                { getPropertyValue: () => '' },
                { get: (target, key) => (key in target ? target[key as 'getPropertyValue'] : '') }
            ) as unknown as CSSStyleDeclaration;
        page.window.requestAnimationFrame = () => 0;
        page.window.cancelAnimationFrame = () => {};
        // The switch clicks itself with a pointer event, which this page does not have.
        (page.window as unknown as Record<string, unknown>).PointerEvent = page.window.Event;

        for (const name of FROM_PAGE) {
            Object.defineProperty(globalThis, name, { value: name === 'window' ? page.window : page.window[name], configurable: true });
        }

        Object.defineProperty(globalThis, 'ResizeObserver', { value: StillResizeObserver, configurable: true });
        Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
        root = createRoot(page.host);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        useProviderAccountsStore.getState().forget(scope.id);

        NAMES.forEach((name, index) => {
            const descriptor = previous[index];

            if (descriptor === undefined) {
                Reflect.deleteProperty(globalThis, name);
            } else {
                Object.defineProperty(globalThis, name, descriptor);
            }
        });
    });

    test('shows the switch on an extra account of a kind that shares, off until it is turned on', async () => {
        await draw(claude, entryOf('claude', 'claude_work'), { kinds: ['claude'] });

        expect(switchNamed()?.getAttribute('aria-checked')).toBe('false');
        expect(page.host.textContent).toContain('Instructions, skills, agents and commands come from the default Claude Code account.');
    });

    test('shows it on when the account holds the flag, and says what stayed apart', async () => {
        const entry = entryOf('claude', 'claude_work', { shareConfig: true });
        entry.status = { ...entry.status!, message: 'Not shared with /home/claude: CLAUDE.md' };
        await draw(claude, entry, { kinds: ['claude'] });

        expect(switchNamed()?.getAttribute('aria-checked')).toBe('true');
        expect(page.host.textContent).toContain('Not shared with /home/claude: CLAUDE.md');
    });

    test('asks the machine to stop sharing when it is turned off', async () => {
        await draw(claude, entryOf('claude', 'claude_work', { shareConfig: true }), { kinds: ['claude'] });

        await flip(false);

        expect(requests).toEqual([{ type: 'accounts.shareConfig', payload: { id: 'claude_work', shared: false } }]);
    });

    test('asks the machine to share when it is turned on', async () => {
        await draw(claude, entryOf('claude', 'claude_work'), { kinds: ['claude'] });

        await flip(true);

        expect(requests).toEqual([{ type: 'accounts.shareConfig', payload: { id: 'claude_work', shared: true } }]);
    });

    test('is absent on the default account, on a kind that shares nothing and on a machine that does not answer', async () => {
        await draw(claude, entryOf('claude', 'claude'), { kinds: ['claude'] });
        expect(switchNamed()).toBeNull();

        await draw(codex, entryOf('codex', 'codex_work'), { kinds: ['claude'] });
        expect(switchNamed()).toBeNull();

        await draw(claude, entryOf('claude', 'claude_work'), { kinds: ['claude'], answers: false });
        expect(switchNamed()).toBeNull();

        await draw(claude, entryOf('claude', 'claude_work'));
        expect(switchNamed()).toBeNull();
    });

    test('stays as it was when the machine refuses, and says why', async () => {
        refuse = true;
        await draw(claude, entryOf('claude', 'claude_work'), { kinds: ['claude'] });

        await flip(true);

        expect(requests).toHaveLength(1);
        expect(switchNamed()?.getAttribute('aria-checked')).toBe('false');
        expect(notices).toEqual(['Could not change what this account shares']);
    });
});
