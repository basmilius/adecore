# Testing

Use a fake provider and an injected transport/storage adapter. Documentation checks should never invoke a person's provider CLI, read credentials, or open a real service. The repository's [agent-port fixture](https://github.com/basmilius/adecore/tree/main/examples/agent-port) already demonstrates the backend-to-React boundary safely.

## Existing integration checks

From the repository root:

```sh
bun run --cwd examples/agent-port test
bun run --cwd examples/agent-port test:dist
bun --conditions=source packages/agents-react/fixtures/storage.mjs
node packages/agents-react/fixtures/storage.mjs
```

Default-export checks require built `dist` artifacts for the dependencies and package. The source fixture uses an in-process fake CLI, temporary data directory, empty PATH, and injected provider detection. It checks protocol events, rendered scope context, reply state, locale assets, and a structured `chat-not-found` refusal. The fixture releases its client, port connection, and backend, then removes only its own temporary directory.

The storage fixture runs in a fresh process so previous tests cannot have hydrated the singleton. It checks zero import-time reads, migration of all four raw records, retained legacy keys, explicit keys, late store imports, live preference keys, late-configuration refusal, and denied writes. Run separate processes for distinct storage configurations; there is no public reset.

## Verify a renderer without a backend

A scope-context render can use an injected transport that refuses every operation. Its methods still match the real contract:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatClient } from '@adecore/agents-react/chat/chat-client';
import { ChatScopeContext, useChatScope, type ChatScope } from '@adecore/agents-react/scope';
import { chatSink } from '@adecore/agents-react/state/chats';
import { ChatTransportError, type ChatTransport } from '@adecore/agents-react/transport';

const transport: ChatTransport = {
    status: 'closed',
    request: async () => {
        throw new ChatTransportError('not-connected', 'Fixture is disconnected');
    },
    on: () => () => {},
    subscribeStatus: () => () => {}
};
const keyOf = (id: string): string => `fixture:${id}`;
const chats = new ChatClient(transport, chatSink(keyOf));
const scope: ChatScope = { id: 'fixture', keyOf, owns: (key) => key.startsWith('fixture:'), transport, chats };

function ScopeName() {
    return <span>{useChatScope().id}</span>;
}

export const markup = renderToStaticMarkup(
    <ChatScopeContext.Provider value={scope}>
        <ScopeName />
    </ChatScopeContext.Provider>
);
chats.dispose();
```

This verifies scope wiring, not interactive chat layout. The composer uses DOM/editor effects; virtualization, focus, drag/drop, object URLs, and workers need a browser-like environment or a desktop integration test. The package's pure logic tests cover keyboard decisions, prompt ordering, replay/history, chips, and render data separately.

## Useful host checks

Test two scope IDs with the same backend chat ID to prove chat-row key isolation, then test globally unique IDs for draft/action routing. Disconnect with pending requests, reconnect an existing client, remove a mounted chat during attach, and return expired history cursors. Assert codes and resulting state instead of localized message strings.

For permissions, test a refused approval, an already-settled request, lasting-grant focus, pointer presses during request replacement, question drafts while paging, and IME Enter. For storage, compare raw JSON before/after migration and deliberately fail writes. Include failed upload recovery because draft persistence can omit bytes.

For styles, check installed `dist` scan roots and linked `src` scan roots, all four namespaces, both theme modes, diff worker loading, and terminal utility mappings. Desktop keyboard and screen-reader verification is still needed for shadow-root diff controls and host slots; package tests do not prove universal accessibility.

## Repository checks

```sh
bun run --cwd packages/agents-react typecheck
bun run --cwd packages/agents-react test
bun test docs/docs.test.ts
bun run --cwd docs typecheck
```

The docs test checks UI export coverage and bans application branding in library pages. It does not compile Markdown fences. Typecheck substantial examples in a temporary consumer with the same peer versions and both export conditions. The repository's full docs build and packed validation remain integration checks after all package/documentation changes land. Do not start a dev or preview server for these checks.
