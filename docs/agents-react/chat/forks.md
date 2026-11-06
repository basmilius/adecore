# Forks

A fork starts a new chat with the history of another up to a turn. The thread offers it on a message once the host passes a `fork(chatId, turnId)` (see [Host adapters](/agents-react/guide/host#fields)); where the fork lands is the app's. These helpers from `@adecore/agents-react/chat` build the dialog and the `chat.fork` request for an app that draws its own.

```ts
import { forkPayload, forkPointLabel, forkPointOf, forkRefusal, lastSettledTurn } from '@adecore/agents-react/chat';
```

## Whether a fork can start

`forkRefusal(info, turn, host)` says why a chat cannot be forked after this turn right now, or returns `null` when it can. `host` is the row of `useProviders` (or `providersOf(scopeId)`). A fork needs a turn of a CLI whose provider reports the `fork` capability (`canForkWith(provider)`; Claude Code and Codex, whose CLIs keep the conversation), a session the CLI named, and no turn running, since a growing transcript cannot be copied. Until the host answered `provider.list`, the CLI is not what refuses.

`summaryRefusal({ busy, originalPresent })` says why a fork cannot write a summary back to its original right now: the original is gone, or a turn runs.

## Where it goes on

`lastSettledTurn(items, order)` returns the last turn that ended, where a fork from a menu without a message goes on after. `forkPointOf(items, order, turnId, whole)` returns a `ForkPoint`: the turn, its number among the turns, whether it is the last, and the first line of what the person asked. Pass `whole` as false while the client holds only the newest page, so the numbers count from there. `forkPointLabel(point, maxPrompt?)` writes the line at the top of the dialog, such as which turn and what it was about.

## What it becomes

A `ForkShape` is `node` or `view`: a chat node on a canvas, or a chat view of its own. `forkShapes(origin)` returns what the dialog offers, the default first: a view forks into a view, and a node into a node or, when asked, a view.

A `ForkWorktreeChoice` puts the fork in a worktree on a new branch, with or without the files as they were after the turn. `branchRefusal(branch, taken)` says why a branch name cannot be used: it is empty or taken. A `ForkCliChoice` is the CLI, model and account the fork goes on with.

## The request

`forkPayload` turns the choices into the payload of `chat.fork`. It sends only what differs from the original:

```ts
const payload = forkPayload({
    chatId,
    turnId,
    title: 'Try the other parser',
    shape: 'view',
    worktree: { branch: 'parser-b', filesAfterTurn: true },
    cli: { original: { provider: 'claude', selection: current }, chosen: { provider: 'claude', selection: picked } }
});

await transport.request('chat.fork', payload);
```

A host that only runs chats refuses `chat.fork` with `chat-unsupported`. See [Checkpoints and forks](/agent-contracts/conversation#checkpoints-and-forks) for the request itself.
