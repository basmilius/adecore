import { afterEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ProviderAccounts, ProviderInfo } from '@adecore/agent-contracts';
import { createPage } from '@adecore/editor/testing';
import { ChatScopeContext, type ChatScope } from '../scope';
import { useProviderAccountsStore, type ProviderAccountsRow } from '../state/provider-accounts';
import { useProvidersStore } from '../state/providers';
import { newAccountChoiceOf, useAccountChoice, useNewAccountChoice, type AccountChoice, type NewAccountChoice } from './account-choice';

const SCOPE = 'account-choice-test';

function machine(accounts: ProviderAccounts['accounts']): ProviderAccounts {
    return { accounts, statuses: [] };
}

const loaded = (accounts: ProviderAccounts | null): ProviderAccountsRow => ({ accounts, loaded: true });

const defaultOff = machine({
    claude: { kind: 'claude', enabled: false },
    claude_work: { kind: 'claude', label: 'Work', home: '~/.claude-work' },
    claude_home: { kind: 'claude', label: 'Home', home: '~/.claude-home' },
    claude_old: { kind: 'claude', label: 'Old', home: '~/.claude-old', enabled: false },
    codex: { kind: 'codex' }
});

const ids = (choice: NewAccountChoice): string[] | null => (choice.status === 'ready' ? choice.offered.map((entry) => entry.id) : null);

describe('the account choice of a new chat', () => {
    test('offers only the accounts that are on, with two or more of them', () => {
        expect(ids(newAccountChoiceOf(loaded(defaultOff), 'claude', 'Claude Code'))).toEqual(['claude_work', 'claude_home']);
    });

    test('offers the one account that is on, the default one too, and none when all are off', () => {
        const one = machine({ claude: { kind: 'claude', enabled: false }, claude_work: { kind: 'claude', home: '~/.claude-work' } });
        expect(ids(newAccountChoiceOf(loaded(one), 'claude', 'Claude Code'))).toEqual(['claude_work']);
        expect(ids(newAccountChoiceOf(loaded(defaultOff), 'codex', 'Codex'))).toEqual(['codex']);
        const none = machine({ claude: { kind: 'claude', enabled: false }, claude_work: { kind: 'claude', home: '~/.claude-work', enabled: false } });
        expect(newAccountChoiceOf(loaded(none), 'claude', 'Claude Code')).toMatchObject({ status: 'ready', offered: [] });
    });

    test('names a default account nobody named after its CLI', () => {
        const choice = newAccountChoiceOf(loaded(defaultOff), 'codex', 'Codex');
        expect(choice.status === 'ready' ? choice.offered.map(choice.nameOf) : null).toEqual(['Codex']);
    });

    test('tells a machine that has not answered from one that keeps no accounts', () => {
        expect(newAccountChoiceOf({ accounts: null, loaded: false }, 'claude', 'Claude Code')).toEqual({ status: 'loading' });
        expect(newAccountChoiceOf(loaded(null), 'claude', 'Claude Code')).toEqual({ status: 'unsupported' });
        expect(newAccountChoiceOf(loaded(defaultOff), 'cursor', 'Cursor')).toEqual({ status: 'unsupported' });
        expect(newAccountChoiceOf(loaded(defaultOff), null, '')).toEqual({ status: 'loading' });
    });
});

describe('the hooks of an account choice', () => {
    afterEach(() => {
        useProviderAccountsStore.getState().forget(SCOPE);
        useProvidersStore.getState().forget(SCOPE);
    });

    // Renders both hooks on the scope's machine and hands back what they answered last.
    async function rendered(
        kind: string,
        account: string | undefined,
        step: () => void
    ): Promise<{ fresh: NewAccountChoice[]; chat: Array<AccountChoice | null> }> {
        const seen = { fresh: [] as NewAccountChoice[], chat: [] as Array<AccountChoice | null> };

        function Probe() {
            seen.fresh.push(useNewAccountChoice(kind));
            seen.chat.push(useAccountChoice(kind, account));

            return null;
        }

        const scope = {
            id: SCOPE,
            keyOf: (chatId: string) => `${SCOPE}/${chatId}`,
            owns: (key: string) => key.startsWith(`${SCOPE}/`)
        } as unknown as ChatScope;

        const page = createPage();
        const names = ['window', 'IS_REACT_ACT_ENVIRONMENT'] as const;
        const previous = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, 'window', { value: page.window, configurable: true });
        Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
        const root = createRoot(page.host);

        try {
            await act(async () =>
                root.render(
                    <ChatScopeContext.Provider value={scope}>
                        <Probe />
                    </ChatScopeContext.Provider>
                )
            );

            await act(async () => step());
        } finally {
            await act(async () => root.unmount());

            names.forEach((name, index) => {
                const descriptor = previous[index];

                if (descriptor === undefined) {
                    Reflect.deleteProperty(globalThis, name);
                } else {
                    Object.defineProperty(globalThis, name, descriptor);
                }
            });
        }

        return seen;
    }

    test('a new chat waits for the machine, then gets only the accounts that are on, under the CLI name', async () => {
        const seen = await rendered('claude', undefined, () => {
            useProvidersStore.getState().setProviders(SCOPE, [{ kind: 'claude', name: 'Claude Code' } as ProviderInfo]);
            useProviderAccountsStore.getState().set(SCOPE, defaultOff);
        });

        expect(seen.fresh[0]).toEqual({ status: 'loading' });
        const last = seen.fresh.at(-1)!;
        expect(last).toMatchObject({ status: 'ready', providerName: 'Claude Code' });
        expect(ids(last)).toEqual(['claude_work', 'claude_home']);
    });

    test('a chat on the turned-off default account still sees it, where a new chat does not', async () => {
        const seen = await rendered('claude', undefined, () => useProviderAccountsStore.getState().set(SCOPE, defaultOff));
        const chat = seen.chat.at(-1)!;
        expect(chat.currentId).toBe('claude');
        expect(chat.offered.map((entry) => entry.id)).toEqual(['claude', 'claude_work', 'claude_home']);
        expect(ids(seen.fresh.at(-1)!)).toEqual(['claude_work', 'claude_home']);
    });

    test('a machine that keeps no accounts answers unsupported, not loading', async () => {
        const seen = await rendered('claude', undefined, () => useProviderAccountsStore.getState().set(SCOPE, null));
        expect(seen.fresh.at(-1)).toEqual({ status: 'unsupported' });
        expect(seen.chat.at(-1)).toBeNull();
    });
});
