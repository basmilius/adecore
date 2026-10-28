# Getting started

## Install

::: code-group

```sh [bun]
bun add @adecore/agents-react @adecore/agent-contracts
```

```sh [npm]
npm install @adecore/agents-react @adecore/agent-contracts
```

```sh [pnpm]
pnpm add @adecore/agents-react @adecore/agent-contracts
```

:::

`@adecore/ui`, React 19, `react-dom`, `i18next` and `react-i18next` are peer dependencies. Set up [`@adecore/ui`](/ui/guide/getting-started) first, since the views use its components and theme.

Import `@adecore/agents` only in the process that runs the chats, never in the page.

## CSS

Import `theme.css` after the theme of `@adecore/ui`, let Tailwind 4 scan the package, and load the typography plugin for Markdown:

```css
@import 'tailwindcss';
@import '@adecore/ui/theme.css';
@import '@adecore/agents-react/theme.css';
@plugin '@tailwindcss/typography';

@source '../node_modules/@adecore/ui/dist';
@source '../node_modules/@adecore/agents-react/dist';
```

The `@source` paths are relative to the CSS file. With a linked checkout and the `source` condition, scan `src` instead of `dist`.

Import `terminal.css` of [`@adecore/terminal`](/terminal/) to give tool output, code and diffs the terminal's colors, including the `--term-ansi-*` colors of command output. Without it, output keeps one color.

## Words

Four namespaces hold the words, in English and Dutch: `agent-chat`, `agent-prompts`, `agent-providers` and `agent-usage` (`AGENTS_NAMESPACES`). `AGENTS_LOCALES.en()` and `AGENTS_LOCALES.nl()` load all four of a language. `@adecore/agents-react/locales/<language>/<namespace>` exports one namespace as its default.

Some helpers call the default `i18next` instance directly. Add the words to that instance and pass it to `UIProvider`:

```ts
import i18next from 'i18next';
import { AGENTS_LOCALES } from '@adecore/agents-react/locales';

await i18next.init({ lng: 'en', fallbackLng: 'en', interpolation: { escapeValue: false } });

for (const [namespace, words] of Object.entries(await AGENTS_LOCALES.en!())) {
    i18next.addResourceBundle('en', namespace, words, true, true);
}
```

`UIProvider` adds the `ui` namespace to the instance it is given; it does not load these four.

## The host

Configure where drafts and preferences are kept before anything reads a store. See [Persistence](/agents-react/guide/persistence).

```ts
import { configureChatStorage } from '@adecore/agents-react';

configureChatStorage({ namespace: 'my-app' });
```

An agent kind your app adds gets its mark once with `configureAgentMarks`. See [Agent marks](/agents-react/providers/marks#a-mark-for-a-kind-the-host-adds).

A `ChatHostProvider` hands the views what only your app can decide. Keep the object in a constant. A field you leave out leaves its part out. See [Host adapters](/agents-react/guide/host).

```tsx
import { ChatHostProvider, type ChatHost } from '@adecore/agents-react';

const CHAT_HOST: Partial<ChatHost> = {
    notify: (toast) => showToast(toast),
    searchFiles: (scopeId, cwd, query, limit) => backend.searchFiles(cwd, query, limit)
};

createRoot(element).render(
    <ChatHostProvider host={CHAT_HOST}>
        <App />
    </ChatHostProvider>
);
```

## A scope

A scope is one host of chats: an id, a transport, and a `ChatClient` that writes into the stores. Make it once per connection, outside render. Over a `FramePort`, such as a `MessagePort`, use `portTransport`:

```ts
import type { FramePort } from '@adecore/agent-contracts/port';
import { ChatClient } from '@adecore/agents-react/chat';
import { portTransport, type ChatScope } from '@adecore/agents-react';
import { chatSink, watchProviderAccounts, providerSinkFor } from '@adecore/agents-react/state';

export function openScope(id: string, port: MessagePort): ChatScope {
    const frames: FramePort = {
        send: (frame) => port.postMessage(frame),
        onFrame: (listener) => {
            const receive = (event: MessageEvent): void => listener(event.data);
            port.addEventListener('message', receive);
            port.start();
            return () => port.removeEventListener('message', receive);
        }
    };
    const transport = portTransport(frames);
    const keyOf = (chatId: string): string => `${id}:${chatId}`;
    const chats = new ChatClient(transport, chatSink(keyOf), providerSinkFor(id));
    watchProviderAccounts(id, transport);
    return { id, keyOf, owns: (key) => key.startsWith(`${id}:`), transport, chats };
}
```

`keyOf` places a chat's row in the shared store and `owns` recognizes those keys; two scopes need keys that never overlap. `providerSinkFor` fills the list of CLIs. `watchProviderAccounts` keeps their accounts current and returns a stop function. [Chat client and state](/agents-react/guide/chat-client) covers the rest, including closing a scope.

## A first chat

Render the scope in `ChatScopeContext`, inside `UIProvider`, and a thread with its composer under it:

```tsx
import { useEffect } from 'react';
import { Composer, Timeline } from '@adecore/agents-react/chat/ui';
import { ChatScopeContext, useChatScope, type ChatScope } from '@adecore/agents-react';
import { useChatRow } from '@adecore/agents-react/state';

function Chat({ chatId, cwd }: { chatId: string; cwd: string }) {
    const scope = useChatScope();
    const info = useChatRow(chatId, (row) => row?.info);

    useEffect(() => {
        void scope.chats.open(chatId, { cwd, runtimeMode: 'supervised' });
        return () => void scope.chats.detach(chatId);
    }, [scope, chatId, cwd]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <Timeline
                chatId={chatId}
                composer={
                    info && (
                        <Composer
                            chatId={chatId}
                            info={info}
                            focused
                            disabled={false}
                            providerFixed={false}
                            onSend={(text, extras) => void scope.chats.send(chatId, text, extras)}
                            onRetarget={(provider, selection) => scope.chats.retarget(chatId, provider, selection)}
                        />
                    )
                }
            />
        </div>
    );
}

export function ChatView({ scope, chatId, cwd }: { scope: ChatScope; chatId: string; cwd: string }) {
    return (
        <ChatScopeContext.Provider value={scope}>
            <Chat chatId={chatId} cwd={cwd} />
        </ChatScopeContext.Provider>
    );
}
```

Give every flex parent down to the thread `min-h-0`. A component that reads a chat outside a `ChatScopeContext` throws.
