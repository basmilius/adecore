# Turns and requests

A chat session owns one provider backend, a projected thread, active turn, prompt queue, and pending requests. The backend can stay alive between turns. `ChatCore` adds stores, client attachments, event replay, and consumer hooks around sessions.

## Open, attach, and send

A new chat uses Claude unless a provider is chosen. Its folder defaults to the host environment's `HOME`, then the OS home. Its model selection is normalized through the provider catalog, its account defaults to the current composer selection/default account, and its mode defaults to `full-access`. Pass those choices explicitly in an application.

`chat.create` also loads a saved chat. Saved provider, cwd, account, and selection take precedence over creation arguments. Use `chat.configure` for supported changes to a loaded chat. The host still rechecks admission and can narrow its persisted mode.

```ts
import type { createAgentClient } from './agent-client.js';

export async function startTurn(client: ReturnType<typeof createAgentClient>, cwd: string) {
    const info = await client.request('chat.create', { chatId: 'review', provider: 'claude', cwd, runtimeMode: 'supervised' });
    const snapshot = await client.request('chat.attach', { chatId: info.chatId, historyLimit: 40 });
    const send = await client.request('chat.send', { chatId: info.chatId, text: 'Describe the project structure.' });
    return { snapshot, send };
}
```

Creation does not launch the CLI. The first send starts it, and a dead backend resumes by native session id on a later send. `chat.send` answers `{ queued, turnId? }`. A queued message waits for the active turn; the optional turn id supports older hosts that omitted it.

Queued records retain prompt references and stored attachments. `chat.unqueue` removes a message and may return it for editing. `chat.sendNow` selects a queued message for immediate submission. Cancellation can pause queue draining; inspect `queuePaused` and current state before assuming remaining prompts will run.

`chat.configure` accepts selection, mode, compatible account, and resume preference. A settings/folder change replaces the process at a turn boundary and resumes the native thread. It does not convert the current conversation to another provider. Switching to an account requires the same provider and shared transcript storage; otherwise use a consumer-owned continuation flow.

## Stream projection

Attach before submitting if you need every thread event. Apply item upserts by id and deltas to their target item. Backend deltas may be coalesced before client delivery, while the thread/store already holds the newest text. `chat.status` reaches all connections; it includes concise pending requests without requiring a thread attachment. Follow [sequence replay](../agent-contracts/frames-and-events#event-delivery-and-replay) on reconnect.

A turn has `running`, `done`, `aborted`, or `error` state. `ChatInfo.running` instead reports process lifetime. An idle chat may keep a live process, background shell task, or native subagent. Use turn ids and background metadata when deciding completion.

`chat.subagent` reads a provider's native conversation and can install a per-client watch. A `chat.subagentChanged` event tells the client to fetch again. Detach/unwatch when the view closes. `chat.stopSubagent` can mark a native subagent stopped rather than individually terminate its process; the provider protocol determines what is possible. `chat.stopTask` stops a named background shell/monitor task only when the backend supports it.

## Approvals and questions

```ts
import type { createAgentClient } from './agent-client.js';

export async function denyPendingTool(client: ReturnType<typeof createAgentClient>, chatId: string) {
    const snapshot = await client.request('chat.attach', { chatId });
    const approval = snapshot.items.find((item) => item.kind === 'approval' && item.decision === 'pending');
    if (approval?.kind === 'approval') {
        await client.request('chat.approve', { chatId, requestId: approval.requestId, decision: 'deny', message: 'Use the provided fixture.' });
    }
}
```

Offer only permissions the provider supplied. `allow-always` applies the specific proposed rule, not a blanket host permission. A request can settle between rendering and clicking; `request-not-found` means refresh the pending state. The same rule applies when another client answered first.

For `chat.answer`, send `{ answers: { [questionId]: value } }`. Dismiss only async questions, using `chat.dismiss` with their item id. Cancellation settles the thread's pending approvals/questions and declines remaining backend requests where supported. It must not leave an active approval attached to a finished turn.

## Cancel, clear, remove, and shutdown

| Operation                                   | Effect                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `chat.cancel`                               | Interrupt the turn and retain its conversation; optional `subagents` also stops/marks delegated work   |
| `chat.clear`                                | Start the chat over and discard its prior content; active turns require explicit `force: true`         |
| `chat.kill`                                 | Remove the chat's record, log, attachments, bookmarks, and in-memory session; request process disposal |
| Client detach/disconnect                    | Release that client's subscriptions; the chat continues                                                |
| `AgentHost.close()` / `ChatCore.shutdown()` | Freeze and save threads, stop services, and await process disposal                                     |

`chat.kill` starts session disposal without awaiting its exit promise. Use host shutdown when you need an awaited process boundary. `ChatChild` closes stdin for graceful stop, waits three seconds before forced termination when needed, sends SIGTERM to the group, and sends SIGKILL after a two-second grace. Exact process behavior needs verification on the consumer's target OS.

## Restart and limit recovery

Graceful shutdown freezes an active turn before saving so the CLI's exit does not turn it into an ordinary failed turn. On load, default recovery aborts an interrupted turn with `notResumedNote`. A host can provide `onInterruptedRun` to durably owe resumption and call `recoverInterrupted()` and `resumeRun(chatId, turnId, attempt)` as part of its startup flow. The core caps restart attempts at two process attempts and respects `endedAt` ownership.

Usage and overload limits remain error turns with `limit` metadata. Automatic retry needs the consumer's `limitResume` hooks and policy; ordinary `AgentHost` wiring does not install a resume scheduler. The per-chat `resumeAtReset` can opt out. Do not automatically switch account or fork on a limit: those flows need explicit host/user decisions and are unsupported by the plain host.
