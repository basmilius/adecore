# Getting started

This page wires blocks end to end: the agent learns the language, the backend compiles replies, the wire carries blocks and the page draws them. With [`@adecore/agents`](/agents/) and [`@adecore/agents-react`](/agents-react/) most of it is configuration. Each step also shows the package used on its own.

## Install

::: code-group

```sh [bun]
bun add @adecore/intelligent-ui
```

```sh [npm]
npm install @adecore/intelligent-ui
```

```sh [pnpm]
pnpm add @adecore/intelligent-ui
```

:::

The package has no React and no DOM, so the backend and the page both import it.

## Tell the agent

`uiSessionNote()` returns a short note (under 2,400 characters) for the start of every session: the tag syntax, the rules for state, actions and expressions, the compact catalog and one example.

```ts
import { ChatCore } from '@adecore/agents/chat';
import { uiSessionNote } from '@adecore/intelligent-ui/text';

const fenceLanguage = 'ui';

const core = (options) =>
    new ChatCore({
        ...options,
        instructions: [appInstructions, uiSessionNote({ fenceLanguage })].join('\n\n'),
        uiFenceLanguage: fenceLanguage
    });
```

`fenceLanguage` is the info string after the opening backticks, `UI_FENCE_LANGUAGE` (`ui`) by default. Pass the same value to the note, the compiler and the session; a fence the compiler does not look for stays code.

`uiReferenceText()` is the long form, with every component's description and every group's rules. Hand it out on request, through a command or a skill, not in every session.

`catalog: 'names'` shortens the note to each component's required props and text content (`Event at (text: title)`). `detailHint` tells the agent how to get a group's optional props, such as a host command. `uiGroupReference(group)` returns the text for that command: the group's description, rules and every component with its props.

```ts
const note = uiSessionNote({ catalog: 'names', detailHint: '`tool help ui <group>` gives props' });
const inputs = uiGroupReference('inputs');
```

## Compile on the backend

`ChatCore` compiles every assistant reply that opens a UI fence:

- While a reply streams, a `UiStream` compiles it at most every 250 ms. Each preview goes to attached clients as a `delta` with `ui` and `textLength`, never into the log.
- `ChatCore` stores the final blocks on the assistant item as `ui`. Each block gets a `revision`, a hash that choices, queries and links name.
- Diagnostics of the final blocks go into a note before the agent's next prompt, so it can repair its syntax.

`ChatCoreOptions.intelligentUi` adds [live queries](/intelligent-ui/host/queries) and [links](/intelligent-ui/host/links). Without it, a block shows its query fallback and links stay text.

Without `@adecore/agents`, run the stream yourself. `UiStream` takes the compiler options, a clock and an `emit` for previews:

```ts
import { UiStream } from '@adecore/intelligent-ui/stream';

const stream = new UiStream({
    id: itemId,
    fenceLanguage: 'ui',
    clock: {
        now: () => Date.now(),
        setTimeout: (run, ms) => setTimeout(run, ms),
        clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
    },
    emit: ({ blocks, textLength }) => sendPreview(itemId, blocks, textLength)
});

onDelta((text) => stream.update(text));
const blocks = stream.finish(finalText);
```

Call `update` with the whole text so far, not the newest piece. `finish` cancels a pending preview and returns the final blocks; store only those. See [compilation and streaming](/intelligent-ui/host/compilation).

## The wire

Blocks travel as JSON, validated by `UiBlocksSchema` from `@adecore/intelligent-ui/protocol`. [`@adecore/agent-contracts`](/agent-contracts/conversation) places them in the chat protocol:

| Where                     | Field or request  | Schema                                                       |
| ------------------------- | ----------------- | ------------------------------------------------------------ |
| Assistant item            | `ui`              | `UiBlocksSchema`, the final blocks                           |
| Assistant item            | `uiAnswers`       | `ChatUiAnswerSchema` per block id, the choice that answered  |
| Assistant item            | `uiQueries`       | `ChatUiQueryStateSchema`, the writer and the first readings  |
| `delta` event             | `ui`, `textLength` | A preview of the blocks for the text up to `textLength`     |
| Request `chat.uiChoice`   | payload, result   | `ChatUiChoicePayloadSchema`, `ChatSendResultSchema`          |
| Request `ui.query`        | payload, result   | `ChatUiQueryPayloadSchema`, `ChatUiQueryReadingSchema`       |
| Request `ui.link`         | payload, result   | `ChatUiLinkPayloadSchema`, `ChatUiLinkReadingSchema`         |

A client applies a preview only while the item's text is `textLength` long, so a preview never draws over newer text. The three requests name a block by `chatId`, `itemId`, `blockId` and `revision`, never by its contents. The agent host answers them only for a client attached to the chat.

## Draw the blocks

The `Timeline` of `@adecore/agents-react` draws an item's `ui` through [`UiReply`](/agents-react/chat/intelligent-ui), between the reply's Markdown. `ChatHost.intelligentUi` decides what a block may do outside itself:

```ts
import type { ChatHost } from '@adecore/agents-react';

// Handed to the `ChatHostProvider` around the views.
const CHAT_HOST: Partial<ChatHost> = {
    intelligentUi: {
        sendChoice: async (scopeId, payload) => ((await transportFor(scopeId).request('chat.uiChoice', payload)).queued ? 'queued' : 'sent'),
        query: (scopeId, payload) => transportFor(scopeId).request('ui.query', payload),
        link: (scopeId, payload) => transportFor(scopeId).request('ui.link', payload),
        openLink: (scopeId, reading) => openInApp(scopeId, reading),
        openUrl: (scopeId, url) => openExternal(url)
    }
};
```

`transportFor`, `openInApp` and `openExternal` are your app's. Every callback except `sendChoice` is optional. Without one, the block degrades: live values keep their first reading, links stay text and sources do not open. `subscribe(scopeId, chatId, changed)` lets the host ask visible blocks to read again, such as after a reconnect, and returns an unsubscribe function.

A page without React evaluates a block itself:

```ts
import { evaluateUiBlock, UiState } from '@adecore/intelligent-ui/runtime';

const state = new UiState(block);
const draw = () => render(evaluateUiBlock(block, state).nodes);
state.subscribe(draw);
draw();
```

`evaluateUiBlock` returns `UiViewNode` objects with validated props, children and bindings. A control calls `node.bindings.value.onValueChange(next)` and a Button calls `node.onAction()`. Both change `state`, which calls `draw` again. See [state and inputs](/intelligent-ui/language/state).

## Choices, queries and links

- A Choice sends its label and context once; the backend checks it against the stored block with `resolveUiChoice`. See [choices](/intelligent-ui/host/choices).
- A live query reads a host source with the writing chat's access. See [live queries](/intelligent-ui/host/queries).
- A File, Diff, Commit or Node becomes a chip only after the host checks it. See [links](/intelligent-ui/host/links).
