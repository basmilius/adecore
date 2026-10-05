# Installation and setup

Set up the host before rendering a component or reading a persistent store. Imports alone do not hydrate storage, so modules can be imported before configuration. See [persistence](./persistence) before choosing keys for an existing host.

## Local checkout and compiled use

This package is private at version `0.0.0`; a registry release is not available yet. In this Bun workspace, depend on `@adecore/agents-react` with `workspace:*`. For a separate local consumer, run `bun link` in the package folder, then `bun link @adecore/agents-react` in the consumer. Link its sibling dependencies as needed.

The manifest offers `source` targets in `src` and default JavaScript/declaration targets in `dist`. A linked bundler must resolve the `source` condition, for example `resolve: { conditions: ['source'] }` in Vite. TypeScript uses `compilerOptions.customConditions: ['source']` with bundler resolution. With ordinary default resolution, build the dependencies and package first. Building `dist` does not make the package public.

The host supplies these peers: `@adecore/ui`, React and React DOM 19.3 or compatible, i18next 26.4 or compatible, and react-i18next 17 or compatible. The current manifest declares `@adecore/ui` `^0.15.0`; local workspace resolution supplies the checked-out UI package. The manifest is the source of exact ranges. [CSS setup](./styling) also requires Tailwind 4 and the typography plugin in the consumer.

Use named imports except for the default diff components:

```ts
import { ChatClient } from '@adecore/agents-react/chat/chat-client';
import { Composer } from '@adecore/agents-react/chat/ui/Composer';
import { Timeline } from '@adecore/agents-react/chat/ui/Timeline';
import DiffPool from '@adecore/agents-react/chat/ui/DiffPool';

export const chatComponents = { ChatClient, Composer, Timeline, DiffPool };
```

## Configure words and storage

Run this startup module once per renderer. This example keeps storage in memory, which is useful for a fixture. A real host should choose its existing namespace or explicit keys.

```ts
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { setChatHost } from '@adecore/agents-react/host';
import { AGENTS_LOCALES } from '@adecore/agents-react/locales';

setChatHost({ storage: { namespace: 'chat-example', storage: null } });

export async function initializeChatWords(language: 'en' | 'nl' = 'en'): Promise<void> {
    const bundles = await AGENTS_LOCALES[language]!();
    await i18next.use(initReactI18next).init({
        lng: language,
        fallbackLng: 'en',
        resources: { [language]: bundles },
        interpolation: { escapeValue: false }
    });
}
```

Components use `react-i18next`; several helpers and transport messages use the default `i18next` import directly. Initialize that same instance and pass it to `UIProvider`. Using an unrelated `createInstance()` only in React leaves those helpers without words. Load all four [agent namespaces](./styling#translations-and-formatters) for each language the host offers.

## Adapt a browser MessagePort

A `FramePort` sends plain frames and returns an unsubscribe function from `onFrame`. The following is a complete browser adapter. It does not import the backend package. The host must transfer a connected `MessagePort` whose other endpoint speaks the [agent protocol](/agent-contracts/).

```ts
import type { FramePort } from '@adecore/agent-contracts/port';
import { ChatClient } from '@adecore/agents-react/chat/chat-client';
import { portTransport } from '@adecore/agents-react/port-transport';
import type { ChatScope } from '@adecore/agents-react/scope';
import { chatSink, useChats } from '@adecore/agents-react/state/chats';
import { providerSinkFor, useProvidersStore } from '@adecore/agents-react/state/providers';
import { watchProviderAccounts, useProviderAccountsStore } from '@adecore/agents-react/state/provider-accounts';
import { useUsageStore } from '@adecore/agents-react/state/usage';

export function createChatRuntime(port: MessagePort, id: string) {
    const frames: FramePort = {
        send: (frame) => port.postMessage(frame),
        onFrame: (listener) => {
            const receive = (event: MessageEvent<unknown>): void => listener(event.data);
            port.addEventListener('message', receive);
            port.start();
            return () => port.removeEventListener('message', receive);
        }
    };
    const transport = portTransport(frames);
    const keyOf = (chatId: string): string => `${id}:${chatId}`;
    const chats = new ChatClient(transport, chatSink(keyOf), providerSinkFor(id));
    const scope: ChatScope = {
        id,
        keyOf,
        owns: (key) => key.startsWith(`${id}:`),
        transport,
        chats
    };
    const stopAccounts = watchProviderAccounts(id, transport);
    return {
        scope,
        dispose(): void {
            stopAccounts();
            chats.dispose();
            transport.close();
            port.close();
            useChats.getState().forgetWhere(scope.owns);
            useProvidersStore.getState().forget(id);
            useProviderAccountsStore.getState().forget(id);
            useUsageStore.getState().forget(id);
        }
    };
}
```

Create this runtime once for a host connection, outside render. `portTransport` starts open and cannot reconnect after `close()`. Its `close()` stops frame listening and rejects pending requests; it does not close the native `MessagePort`, so the adapter owner does that separately. For a reconnecting socket, implement [ChatTransport](./reference-runtime#transport) with status transitions on the same transport object.

Render `ChatScopeContext.Provider` around the [chat composition](./chat-lifecycle#render-a-thread-and-composer), inside [UIProvider](/ui/utilities/ui-provider). Supply a distinct stable `id` per backend and nonoverlapping `keyOf`/`owns` functions. Use chat IDs that are unique across the renderer for drafts and host actions, even though the chat-row store also uses scope keys.

The [agent-port example](https://github.com/basmilius/adecore/tree/main/examples/agent-port) is a runnable Node/Bun integration fixture with an in-process provider. Its backend imports belong to the fixture process, not a browser bundle.
