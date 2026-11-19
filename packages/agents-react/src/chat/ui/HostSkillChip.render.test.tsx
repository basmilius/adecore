import { afterEach, expect, test } from 'bun:test';
import type { ChatUserItem } from '@adecore/agent-contracts';
import { createPage } from '@adecore/editor/testing';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ChatThreadInfo, ChatThreadItem } from '../../chat-sink';
import { ChatHostProvider, type ChatHost } from '../../host/host';
import { ChatScopeContext, type ChatScope } from '../../scope';
import { useChats } from '../../state/chats';
import { messageClipboardChips } from './chip-clipboard';
import { UserRow } from './rows/MessageRows';

const scope = {
    id: 'host-skill-chip',
    keyOf: (chatId: string) => `host-skill-chip/${chatId}`,
    owns: (key: string) => key.startsWith('host-skill-chip/')
} as unknown as ChatScope;

const info = { chatId: 'chat', provider: 'claude', status: 'idle', activeTurnId: null, background: [] } as unknown as ChatThreadInfo;
const mark = { title: 'Host', path: 'M0 0h24v24H0z' };
const item = { id: 'ask', kind: 'user', turnId: 'turn', createdAt: 0, text: 'Use $own-design and $review', skills: ['own-design', 'review'] } as ChatUserItem;

const fromPage = ['window', 'document', 'Node', 'Element', 'HTMLElement'] as const;
const names = [...fromPage, 'IS_REACT_ACT_ENVIRONMENT'] as const;
const previous = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
let root: Root | null = null;

afterEach(async () => {
    const mounted = root;
    root = null;
    await act(async () => mounted?.unmount());
    useChats.getState().forget(scope.keyOf('chat'));

    names.forEach((name, index) => {
        const descriptor = previous[index];

        if (descriptor === undefined) {
            delete (globalThis as Record<string, unknown>)[name];
        } else {
            Object.defineProperty(globalThis, name, descriptor);
        }
    });
});

async function chipsOf(host: Partial<ChatHost>): Promise<Element[]> {
    useChats.getState().reset(scope.keyOf('chat'), info, [item as ChatThreadItem]);
    const page = createPage();

    for (const name of fromPage) {
        Object.defineProperty(globalThis, name, { value: name === 'window' ? page.window : page.window[name], configurable: true });
    }

    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    const mounted = createRoot(page.host);
    root = mounted;

    await act(async () =>
        mounted.render(
            <ChatHostProvider host={host}>
                <ChatScopeContext.Provider value={scope}>
                    <UserRow chatId="chat" item={item} />
                </ChatScopeContext.Provider>
            </ChatHostProvider>
        )
    );

    return [...page.host.querySelectorAll('[data-chip="skill"]')];
}

test("a host's own skill in a message shows its title under the host's mark, and a copy holds $name", async () => {
    const chips = await chipsOf({ useSkills: () => [{ name: 'own-design', title: 'design', description: '', icon: mark }] });

    expect(chips.map((chip) => [chip.getAttribute('data-chip-value'), chip.querySelector('.select-none')?.textContent ?? chip.textContent])).toEqual([
        ['own-design', 'design'],
        ['review', '$review']
    ]);
    expect(chips[0]?.querySelector('path')?.getAttribute('d')).toBe(mark.path);
    expect(messageClipboardChips(item, item.text, { items: [] })).toMatchObject({ text: item.text, skills: ['own-design', 'review'] });
});

test('without a host that names skills, every skill keeps its name', async () => {
    const chips = await chipsOf({});

    expect(chips.map((chip) => chip.textContent)).toEqual(['$own-design', '$review']);
});
