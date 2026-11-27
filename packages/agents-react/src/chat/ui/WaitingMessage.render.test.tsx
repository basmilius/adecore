import { expect, test } from 'bun:test';
import { createPage } from '@adecore/editor/testing';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatThreadInfo } from '../../chat-sink';
import { ChatHostProvider, type ChatActions, type ChatHost } from '../../host/host';
import { ChatScopeContext, type ChatScope } from '../../scope';
import { useChats } from '../../state/chats';
import type { ChatThreadBackgroundTask } from '../activity';
import { QueuedMessages } from './composer/QueuedMessages';
import { NoteRow } from './rows/MessageRows';

const scope = {
    id: 'waiting-message',
    keyOf: (chatId: string) => `waiting-message/${chatId}`,
    owns: (key: string) => key.startsWith('waiting-message/')
} as unknown as ChatScope;

const WAIT_NOTE = 'Your message waits until "gh run watch 42" ends, because the model changed.';

const watch: ChatThreadBackgroundTask = { id: 'watch', kind: 'shell', description: 'gh run watch 42', command: 'gh run watch 42 --exit-status', startedAt: 0 };

function infoWith(background: ChatThreadBackgroundTask[]): ChatThreadInfo {
    return { chatId: 'chat', provider: 'claude', status: 'idle', activeTurnId: null, background } as unknown as ChatThreadInfo;
}

test('a message that waits for a background task offers Stop for it, in its note and over the composer', async () => {
    const stopped: [string, string][] = [];

    const host: Partial<ChatHost> = {
        actions: {
            stopTask: async (chatId: string, taskId: string) => {
                stopped.push([chatId, taskId]);
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
    useChats.getState().status(scope.keyOf('chat'), infoWith([watch]));
    const root = createRoot(page.host);

    const stops = (): HTMLButtonElement[] => [...page.host.querySelectorAll<HTMLButtonElement>('button')].filter((button) => button.textContent === 'Stop');

    try {
        await act(async () =>
            root.render(
                <ChatHostProvider host={host}>
                    <ChatScopeContext.Provider value={scope}>
                        <NoteRow id="settings-wait-1" level="info" text={WAIT_NOTE} chatId="chat" stops="watch" />
                        <QueuedMessages
                            chatId="chat"
                            queue={[{ id: 'queued-1', turnId: 'turn-2', text: 'And then?', createdAt: 1 }]}
                            paused={false}
                            held={{ task: watch }}
                            takingBack={false}
                            onEdit={() => undefined}
                        />
                    </ChatScopeContext.Provider>
                </ChatHostProvider>
            )
        );

        expect(page.host.textContent).toContain(WAIT_NOTE);
        expect(page.host.textContent).toContain('Waiting for gh run watch 42 to end');
        expect(stops()).toHaveLength(2);

        for (const button of stops()) {
            await act(async () => button.click());
        }

        expect(stopped).toEqual([
            ['chat', 'watch'],
            ['chat', 'watch']
        ]);

        await act(async () => useChats.getState().status(scope.keyOf('chat'), infoWith([])));

        // The note stays in the thread after the task ended, with nothing left to stop.
        expect(page.host.textContent).toContain(WAIT_NOTE);
        expect(stops()).toHaveLength(1);
    } finally {
        await act(async () => root.unmount());
        useChats.getState().forgetWhere((key) => key.startsWith('waiting-message/'));

        names.forEach((name, index) => {
            const descriptor = previous[index];

            if (descriptor === undefined) {
                Reflect.deleteProperty(globalThis, name);
            } else {
                Object.defineProperty(globalThis, name, descriptor);
            }
        });
    }
});
