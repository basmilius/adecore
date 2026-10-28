# Subagents

An agent a chat delegated to has a row in the thread with its task, its state and the report it ended with. Its own conversation lives in the CLI's transcript, and the views read it from there on request.

```tsx
import { SubagentTimeline, SubagentBreadcrumb, SubagentTitleCrumb } from '@adecore/agents-react/chat/ui';
```

<Demo src="agents/subagents" />

## Opening a conversation

Which conversation a chat shows is its trail: the steps down from the main agent, empty while the main agent is on screen. A subagent row's open button, or an entry of the subagent flyout over the composer, sets it. `useSubagentTrail(chatId)` answers `{ trail, show }`; draw a `SubagentTimeline` for the last step as the [timeline's](/agents-react/chat/timeline#props) overlay. The trail lives for the page only.

`SubagentTimeline({ chatId, toolUseId })` reads the conversation with `chat.subagent`, 60 items at a time, and keeps reading while the host says it grows. Messages are read only. The main composer underneath collects approvals and questions from delegated chats, with a badge naming the child. A person's answer goes to that child; requests from before the newest history page remain available. The conversation panel draws no second prompt card. A subagent the subagent opened goes one step further down.

Drawn anywhere else than in the chat's own place, such as in a panel beside the chat, pass `info={false}` to leave out the header and its way back through the chat's trail, and `onOpenConversation(step)` to open a subagent it opened in a trail of that panel's own; without it, the step goes onto the chat's trail.

`SubagentInfo({ chatId, toolUseId })` is the header over it: state, time, model and what it spent, and the task it was given behind a fold.

## Workflows

A Workflow call is a row of its own in the thread (`WorkflowRow`): its phases, the agents it started in each and what they do. An agent has no call of its own, so its conversation is named `workflowAgentRef(agentId)`; a `SubagentTimeline` with that id reads it like any other.

For a view of a workflow outside the thread, the helpers in `@adecore/agents-react/chat` read it the way the row does. `workflowPhases(workflow, running)` answers a `WorkflowPhaseView` per phase in the script's order, each with a `WorkflowAgentView` per agent, and agents of no known phase first under the key `loose`; pass the call's `state === 'running'` as `running`, since the call's state, not a stall warning, says whether the workflow lives. `workflowAgentState(agent, running)` is a `WorkflowAgentState`: `running`, `waiting`, `stopped`, `done` or `failed`. `workflowCounts(phases)` counts the agents by state (`WorkflowCounts`), `workflowAgentTime(view)` is the time an agent's line shows, `workflowAgentPreview(view)` its second line (`WorkflowAgentPreview`), and `workflowDescription(input)` the description in the script's `meta`.

`workflowPhaseState(phase)` is a `WorkflowPhaseState`: a `WorkflowPhaseStateKind` (`running` while an agent of it is at work or some settled and others wait, `waiting` before any started, then `done`, or `failed` when one failed or stopped), with how many of its agents `settled` of the `total`. `workflowPhaseTime(phase)` is a `WorkflowPhaseTime` from the first start to the last known end, with `endedAt` null while an agent is at work; agents of a phase run beside each other, so it is never their sum. `liveWorkflowPhase(phases, running)` is the key of the phase to keep open by itself: the one with an agent at work, the one whose agent started last when several are, before that the first that waits, and null once the workflow stopped running.

`WorkflowAgentLine({ view, provider, onOpen?, selected?, className?, ref? })` is the row's line for one agent, for a list of your own: it opens the agent's conversation through `onOpen` once the agent started, carries `data-workflow-agent` with the agent's index, and `selected` marks the one whose conversation is open (`aria-pressed`).

## Crumbs

`SubagentBreadcrumb({ chatId, title?, className? })` is the way back up, a crumb per step and a close that goes back to the main agent; it draws nothing on the main agent. Pass `title` when your header does not draw the chat's title itself. `SubagentTitleCrumb({ chatId, children })` makes your own title the first crumb while a subagent is on screen.

## Progress

`progressOf(states)` counts the delegated work that is done out of all of it, and the activity chip shows the count; a child that waits on a person shows a question mark and a note that opens it.

## Stopping

The stop button of a subagent stops it, or draws nothing when stopping it is not on offer. A subagent the CLI opened and named by task id is ended on its own, turn or not (`stop` `native`); one without a task id can only be marked stopped once the turn ended (`stop` `mark`); one your app opened with a task of its own is stopped through `stopTask`, after the host's `confirm.stopTask`. Shift with the composer's Stop also ends every agent the chat opened, after `confirm.stopSubagents`.

## Older hosts

A host without `chat.subagent` refuses it with `unknown-request`. The first refusal hides the open button on that host's rows that carry no pointer of their own (`useSubagentSupport`); the rows themselves still draw. `history-expired` reads the newest page again.

`SubagentConversation` is the reader behind `SubagentTimeline`, for a view of your own: construct it with the transport, chat id, call id and a state setter, `start()` it once and `dispose()` it on unmount, which stops the watch and leaves the subagent running. The helpers in `@adecore/agents-react/chat` (`subagentTitle`, `summaryWordOf`, `stopOf`, `useSubagentView`, `useSubagentTrail`, `crumbOf`, ...) name, order and count subagents the way the flyout and the crumbs do.
