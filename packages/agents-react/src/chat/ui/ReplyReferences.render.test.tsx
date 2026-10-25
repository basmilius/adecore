import { expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatInfo, ChatItem } from '@adecore/agent-contracts';
import { createPage } from '@adecore/editor/testing';
import { ChatHostProvider, type ChatHost } from '../../host';
import { ChatScopeContext, type ChatScope } from '../../scope';
import { useChats } from '../../state/chats';
import type { Referables } from '../chat-references';
import { AssistantRow } from './rows/MessageRows';

const scope = {
    id: 'reply-references',
    keyOf: (chatId: string) => `reply-references/${chatId}`,
    owns: (key: string) => key.startsWith('reply-references/')
} as unknown as ChatScope;

const info = { chatId: 'chat', provider: 'claude', status: 'idle', activeTurnId: null, background: [] } as unknown as ChatInfo;

const referables: Referables = {
    items: [
        { id: 'view-admin', name: 'Admin', kind: 'canvas', group: 'views' },
        { id: 'view-admin-panel', name: 'Admin panel', kind: 'drawing', group: 'views' },
        { id: 'node-notes', name: 'Notes', kind: 'note', group: 'canvas' },
        { id: 'view-notes', name: 'Notes', kind: 'note', group: 'views' },
        { id: 'node-todo', name: 'Todo', kind: 'note', group: 'canvas' },
        { id: 'view-todo', name: 'Todo', kind: 'note', group: 'views' }
    ],
    chatsOnly: false
};

const reply = [
    '# Admin',
    '',
    'I changed #Admin panel and #Admin? `#Admin` stays code, #Notes is two things, and #Todo is the one you named.',
    '',
    '```',
    '#Admin',
    '```'
].join('\n');

test('a reply spells a view or node as #Name, and that chip opens it like a chip a person picked', async () => {
    const opened: string[] = [];
    const host: Partial<ChatHost> = {
        useStreaming: () => 'blocks',
        useReferables: () => referables,
        openReference: (_scopeId, id) => {
            opened.push(id);
        }
    };
    const items = [
        { id: 'ask', kind: 'user', turnId: 'turn', createdAt: 0, text: 'Look at #Todo', references: ['view-todo'] },
        { id: 'answer', kind: 'assistant', turnId: 'turn', createdAt: 1, text: reply, streaming: false }
    ] as ChatItem[];
    useChats.getState().reset(scope.keyOf('chat'), info, items);
    const page = createPage();
    const fromPage = ['window', 'document', 'Node', 'Element', 'HTMLElement'] as const;
    const names = [...fromPage, 'IS_REACT_ACT_ENVIRONMENT'] as const;
    const previous = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
    for (const name of fromPage) {
        Object.defineProperty(globalThis, name, { value: name === 'window' ? page.window : page.window[name], configurable: true });
    }
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    const root = createRoot(page.host);
    try {
        await act(async () =>
            root.render(
                <ChatHostProvider host={host}>
                    <ChatScopeContext.Provider value={scope}>
                        <AssistantRow chatId="chat" item={items[1] as Extract<ChatItem, { kind: 'assistant' }>} />
                    </ChatScopeContext.Provider>
                </ChatHostProvider>
            )
        );
        const chips = [...page.host.querySelectorAll('[data-chip]')];
        expect(chips.map((chip) => [chip.getAttribute('data-chip-value'), chip.textContent])).toEqual([
            ['view-admin-panel', '#Admin panel'],
            ['view-admin', '#Admin'],
            ['view-todo', '#Todo']
        ]);
        expect(page.host.querySelector('h1')?.textContent).toBe('Admin');
        expect(page.host.querySelector('code')?.textContent).toBe('#Admin');
        expect(page.host.querySelector('pre')?.textContent).toContain('#Admin');
        expect(page.host.textContent).toContain('#Notes is two things');
        const panel = chips[0] as HTMLElement;
        expect(panel.getAttribute('role')).toBe('button');
        await act(async () => panel.click());
        await act(async () => {
            panel.dispatchEvent(Object.assign(new page.window.Event('keydown', { bubbles: true, cancelable: true }), { key: 'Enter' }));
        });
        expect(opened).toEqual(['view-admin-panel', 'view-admin-panel']);
    } finally {
        await act(async () => root.unmount());
        useChats.getState().forget(scope.keyOf('chat'));
        names.forEach((name, index) => {
            const descriptor = previous[index];
            if (descriptor === undefined) {
                delete (globalThis as Record<string, unknown>)[name];
            } else {
                Object.defineProperty(globalThis, name, descriptor);
            }
        });
    }
});
