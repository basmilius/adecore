# Reference

Every name each entry point exports, types included, read from its source. Anything not listed is internal and may change in any release.

Two entries hold data rather than names. `@adecore/agents-react/theme.css` holds the styles (see [Getting started](/agents-react/getting-started#css)), and `@adecore/agents-react/locales/<language>/<namespace>` holds one namespace in one language as its default export.

Derive a prop or option type that is not exported, as `ComponentProps<typeof Composer>` or `Parameters<ChatClient['open']>[1]`.

## `@adecore/agents-react`

Wiring the views into an app: the host adapters, the scope, the transport, storage, lazy loading and the settings sections. See [Host adapters](/agents-react/guide/host).

<ExportTable entry="@adecore/agents-react" />

## `@adecore/agents-react/chat`

A chat outside its views: the client, actions, drafts, preferences, mentions, forks, the rows of a thread and subagent navigation. See [Chat client and state](/agents-react/guide/chat-client).

<ExportTable entry="@adecore/agents-react/chat" />

## `@adecore/agents-react/chat/ui`

The views of a chat: the thread, the composer, messages, diffs, subagents, limits, the rows of a thread and smaller parts for a layout of your own. See [Timeline](/agents-react/chat/timeline).

<ExportTable entry="@adecore/agents-react/chat/ui" />

## `@adecore/agents-react/prompts`

Approvals and questions: the prompt view, and the parts and logic to build one of your own. See [Prompts](/agents-react/chat/prompts).

<ExportTable entry="@adecore/agents-react/prompts" />

## `@adecore/agents-react/providers`

The CLIs and their accounts: marks, model names, the providers pane and its parts. See [Providers pane](/agents-react/providers/providers-pane).

<ExportTable entry="@adecore/agents-react/providers" />

## `@adecore/agents-react/state`

The stores the views read: chats, providers, accounts and usage. See [Chat client and state](/agents-react/guide/chat-client).

`ChatSink.replay` is optional. A sink that implements it receives missed events as one ordered batch when a chat reconnects; other sinks receive the same events one by one through `apply`. The built-in `chatSink` publishes the batch once, and keeps earlier snapshots and the timeline's structural state. Live events still use `apply`.

<ExportTable entry="@adecore/agents-react/state" />

## `@adecore/agents-react/usage`

What the CLIs cost and their plan limits: the usage page, dialog and pane, and their parts. See [Usage page](/agents-react/usage/usage-page).

<ExportTable entry="@adecore/agents-react/usage" />

## `@adecore/agents-react/locales`

The words of the views, per language and namespace. See [Getting started](/agents-react/getting-started#words).

<ExportTable entry="@adecore/agents-react/locales" />

## `@adecore/agents-react/testing`

Prompts in every state, for tests and demos. See [Testing](/agents-react/guide/testing).

<ExportTable entry="@adecore/agents-react/testing" />

## `@adecore/agents-react/images`

`imageForDisplay(blob)` decodes HEIC and HEIF into PNG for a browser display URL or canvas. Other formats keep their original blob. The decoder loads on demand and works under a CSP without `unsafe-eval`.

`DisplayImage` (also exported by `@adecore/agents-react/chat/ui`) adds a HEIC and HEIF fallback to native image props. Remote sources must allow cross-origin reads.

`VisualPageFrame` replaces embedded HEIC and HEIF data URLs in a page with PNG data URLs before it hands the page to its sandbox. It leaves unreadable images in place so the rest of the document can open.

<ExportTable entry="@adecore/agents-react/images" />
