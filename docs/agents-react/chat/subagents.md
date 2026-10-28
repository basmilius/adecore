# Subagents

A subagent has a row in the thread with its task, state and final report. The views read its own conversation from the CLI's transcript on request.

```tsx
import { SubagentTimeline, SubagentBreadcrumb, SubagentTitleCrumb } from '@adecore/agents-react/chat/ui';
```

<Demo src="agents/subagents" />

## Opening a conversation

A chat's trail holds the steps down from the main agent; it is empty on the main agent and lasts for the page. A row's open button or the subagent flyout over the composer sets it. `useSubagentTrail(chatId)` returns `{ trail, show }`; draw a `SubagentTimeline` for the last step as the [timeline's](/agents-react/chat/timeline#props) overlay.

`SubagentTimeline({ chatId, toolUseId })` reads the conversation with `chat.subagent` and follows it while it grows. It is read-only and draws no prompt cards; the main composer answers the child's approvals and questions. A nested subagent opens one step further down.

`SubagentInfo({ chatId, toolUseId })` is the header: state, time, model, spend, and the task behind a fold.

## Crumbs

`SubagentBreadcrumb({ chatId, title?, className? })` leads back up, with a crumb per step and a close back to the main agent. It draws nothing on the main agent. Pass `title` when your header does not draw the chat's title. `SubagentTitleCrumb({ chatId, children })` makes your own title the first crumb.

## Progress

`progressOf(states)` counts finished delegated work, which the activity chip shows. A child waiting on a person shows a question mark.

## Stopping

A subagent's stop button draws only when it can stop:

- `stop` `native`: the CLI named it by task id, and it ends on its own.
- `stop` `mark`: no task id, so it is marked stopped once the turn ends.
- A task your app opened stops through `stopTask`, after the host's `confirm.stopTask`.

Shift with the composer's Stop also ends every agent the chat opened, after `confirm.stopSubagents`.

## Older hosts

A host without `chat.subagent` refuses it with `unknown-request`, and `useSubagentSupport` then hides the open buttons on its rows. `history-expired` reloads the newest page.

`SubagentConversation` is the reader behind `SubagentTimeline`. Construct it with the transport, chat id, call id and a state setter, `start()` it once and `dispose()` it on unmount; the subagent keeps running. The helpers in `@adecore/agents-react/chat` (`subagentTitle`, `summaryWordOf`, `stopOf`, `useSubagentView`, `useSubagentTrail`, `crumbOf`, ...) name, order and count subagents as the flyout and crumbs do.
