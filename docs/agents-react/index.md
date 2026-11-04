# Agent views

`@adecore/agents-react` holds the React views of agent chats: the thread, the composer, approvals and questions, the agent CLIs and their accounts, and what they cost. It runs in the page and talks to a host of chats, such as [`@adecore/agents`](/agents/), over the requests and events of [`@adecore/agent-contracts`](/agent-contracts/).

```tsx
import { Timeline, Composer } from '@adecore/agents-react/chat/ui';
```

<Demo src="agents/chat" />

The demos run on an in-memory host with two CLIs, three accounts and a chat two turns in. Send a message and it answers a word at a time; mention a check or a test and it asks for permission first. Nothing leaves the page.

## What it does

- Draws a chat: the [timeline](/agents-react/chat/timeline) of its thread, the [composer](/agents-react/chat/composer) that writes to it, and the [prompts](/agents-react/chat/prompts) for the approvals and questions it waits on.
- Offers the parts for a layout of your own: [messages and code](/agents-react/chat/messages), [diffs](/agents-react/chat/diffs), [subagents](/agents-react/chat/subagents), [limits](/agents-react/chat/limits) and [smaller parts](/agents-react/chat/parts).
- Draws what an agent publishes in a reply: [UI blocks](/agents-react/chat/intelligent-ui) and [visuals](/agents-react/chat/visuals).
- Shows the settings of the CLIs and their accounts in the [providers pane](/agents-react/providers/providers-pane), with [marks](/agents-react/providers/marks) and a [model picker](/agents-react/providers/model-picker).
- Shows what the CLIs cost on the [usage page](/agents-react/usage/usage-page), with its [charts and tiles](/agents-react/usage/charts) and the [plan limits](/agents-react/usage/limits).
- Keeps drafts and preferences across a reload.

## How it fits together

```
your app        ChatHostProvider          words, files, navigation
  |
scope           ChatScopeContext          one per host of chats
  |               transport               requests and events
  |               ChatClient              writes them into the stores
  |
views           Timeline, Composer, ...   read the stores of their scope
```

The views read a chat from a store, never from the wire. A `ChatClient` fills the store from a `ChatTransport`, which reaches the host. A `ChatScope` bundles the two with an id in context, so two hosts get two scopes whose threads never mix.

## What it leaves to the app

The package starts no process and registers no channel. The app hands it a port to the host, and decides what only it can know through a `ChatHostProvider`: where a file opens, how a toast shows, which words name its own commands. A field the app leaves out leaves its part out. Import `@adecore/agents` only in the process that runs the chats, never in the page.

## Where to next

- [Getting started](/agents-react/getting-started) installs the package, its CSS and its words, connects a scope to the host and renders a first chat.
- [Host adapters](/agents-react/guide/host) lists what a `ChatHostProvider` takes and what each part does without it.
- [Chat client and state](/agents-react/guide/chat-client) covers opening, sending, reconnecting and reading the stores.
- [Persistence](/agents-react/guide/persistence) covers drafts, preferences and their storage keys.
- [Testing](/agents-react/guide/testing) shows a host in memory like the one these demos use.
- [Timeline](/agents-react/chat/timeline), [Composer](/agents-react/chat/composer), [Prompts](/agents-react/chat/prompts), [Messages and code](/agents-react/chat/messages), [Diffs](/agents-react/chat/diffs), [Subagents](/agents-react/chat/subagents), [Limits](/agents-react/chat/limits), [Chat parts](/agents-react/chat/parts), [Attachments and mentions](/agents-react/chat/attachments), [Intelligent UI](/agents-react/chat/intelligent-ui) and [Visuals](/agents-react/chat/visuals) cover the views of a chat.
- [Providers pane](/agents-react/providers/providers-pane), [Model picker](/agents-react/providers/model-picker) and [Agent marks](/agents-react/providers/marks) cover the CLIs and their accounts.
- [Usage page](/agents-react/usage/usage-page), [Charts and tiles](/agents-react/usage/charts) and [Plan limits](/agents-react/usage/limits) cover what the CLIs cost.
- [Reference](/agents-react/reference) lists every export of every entry point.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/agents-react/LICENSE).
