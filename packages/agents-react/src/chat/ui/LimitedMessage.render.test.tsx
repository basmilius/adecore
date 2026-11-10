import { expect, test } from 'bun:test';
import { createPage } from '@adecore/editor/testing';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatHostProvider, type ChatActions, type ChatHost } from '../../host/host';
import { ChatScopeContext, type ChatScope } from '../../scope';
import { SentMessageRow } from './rows/MessageRows';

const scope = {
    id: 'limited-messages',
    keyOf: (chatId: string) => `limited-messages/${chatId}`,
    owns: (key: string) => key.startsWith('limited-messages/')
} as unknown as ChatScope;

test('a message held by the limit says so, and Deliver now sends the person a prompt that takes it', async () => {
    const sent: [string, string][] = [];

    const host: Partial<ChatHost> = {
        useStreaming: () => 'blocks',
        useReferables: () => ({ items: [], chatsOnly: false }),
        outsideReference: () => null,
        actions: {
            send: async (chatId: string, text: string) => {
                sent.push([chatId, text]);
            }
        } as unknown as ChatActions
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
                        <SentMessageRow chatId="chat" id="held" message={{ from: 'lead', title: 'Lead', text: 'Next step', state: 'waiting', limited: true }} />
                        <SentMessageRow chatId="chat" id="queued" message={{ from: 'lead', title: 'Lead', text: 'And this', state: 'waiting' }} />
                    </ChatScopeContext.Provider>
                </ChatHostProvider>
            )
        );

        const text = page.host.textContent ?? '';

        expect(text).toContain('Waiting: messages woke this chat as often as they may this hour');
        expect(text).toContain('Waiting for the next turn');

        const buttons = [...page.host.querySelectorAll<HTMLButtonElement>('button')].filter((button) => button.textContent === 'Deliver now');

        expect(buttons).toHaveLength(1);

        await act(async () => buttons[0]!.click());

        expect(sent).toEqual([['chat', 'Read the waiting messages and act on them.']]);
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
