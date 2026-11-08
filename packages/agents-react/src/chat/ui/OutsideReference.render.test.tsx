import { expect, test } from 'bun:test';
import { createPage } from '@adecore/editor/testing';
import { Plug } from 'lucide-react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatHostProvider, type ChatHost } from '../../host';
import { ChatScopeContext, type ChatScope } from '../../scope';
import { SentMessageRow } from './rows/MessageRows';

const scope = {
    id: 'outside-references',
    keyOf: (chatId: string) => `outside-references/${chatId}`,
    owns: (key: string) => key.startsWith('outside-references/')
} as unknown as ChatScope;

test('a sender the host knows from outside wears its mark and name, and opens what the host opens', async () => {
    const opened: string[] = [];

    const host: Partial<ChatHost> = {
        useStreaming: () => 'blocks',
        useReferables: () => ({ items: [], chatsOnly: false }),
        outsideReference: (scopeId, id) =>
            id === 'outside-client'
                ? {
                      icon: Plug,
                      open: () => {
                          opened.push(`${scopeId}/${id}`);
                      }
                  }
                : null
    };

    const page = createPage();
    const fromPage = ['window', 'document', 'Node', 'Element', 'HTMLElement', 'SVGElement'] as const;
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
                        <SentMessageRow chatId="chat" id="from-outside" message={{ from: 'outside-client', title: 'Hosted bot', text: 'Hello' }} />
                        <SentMessageRow chatId="chat" id="from-gone" message={{ from: 'gone-node', title: 'Old node', text: 'Bye' }} />
                    </ChatScopeContext.Provider>
                </ChatHostProvider>
            )
        );

        const chips = [...page.host.querySelectorAll<HTMLElement>('[data-chip]')];

        expect(chips.map((chip) => [chip.textContent, chip.getAttribute('role')])).toEqual([
            ['Hosted bot', 'button'],
            ['Old node', null]
        ]);
        expect(chips[0]?.querySelector('svg')?.getAttribute('class')).toContain('lucide-plug');

        await act(async () => chips[0]?.click());

        expect(opened).toEqual(['outside-references/outside-client']);
    } finally {
        await act(async () => root.unmount());

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
