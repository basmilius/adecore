# Testing

The views need only a transport, so a test or demo can answer from memory. The demos on this site use [`FakeAgentHost`](https://github.com/basmilius/adecore/blob/main/docs/demos/shared/agents-host.ts), which answers from fixtures.

## A transport in memory

A transport that refuses everything is enough to check that a view renders:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatClient } from '@adecore/agents-react/chat';
import { ChatScopeContext, type ChatScope, ChatTransportError, type ChatTransport } from '@adecore/agents-react';
import { chatSink } from '@adecore/agents-react/state';

const transport: ChatTransport = {
    status: 'closed',
    request: async () => {
        throw new ChatTransportError('not-connected', 'There is no host in this test.');
    },
    on: () => () => undefined,
    subscribeStatus: () => () => undefined
};

const keyOf = (chatId: string): string => `test:${chatId}`;
const scope: ChatScope = { id: 'test', keyOf, owns: (key) => key.startsWith('test:'), transport, chats: new ChatClient(transport, chatSink(keyOf)) };

const html = renderToStaticMarkup(<ChatScopeContext.Provider value={scope}>{view}</ChatScopeContext.Provider>);
```

To draw a thread without a host, write it into the store: `useChats.getState().reset(keyOf(chatId), info, items)`. To make it move, answer `chat.send` and emit `chat.event`s from the transport.

## Storage

The storage configuration cannot be reset, so a test that needs its own runs in a separate process. Use `storage: null` or a `Map` adapter. See [Persistence](/agents-react/guide/persistence).

## Words

Load the four namespaces on the default `i18next` instance before rendering, or the views show their keys. A static render runs no effects, so the editor, the virtualized thread and the diff workers need a browser.
