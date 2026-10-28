# Subagents

A subagent has a row in the thread with its task, state and final report. The views read its own conversation from the CLI's transcript on request.

```tsx
import { SubagentTimeline, SubagentBreadcrumb, SubagentTitleCrumb } from '@adecore/agents-react/chat/ui';
```

<Demo src="agents/subagents" />

## Opening a conversation

A chat's trail holds the steps down from the main agent; it is empty on the main agent and lasts for the page. A row's open button or the subagent flyout over the composer sets it. `useSubagentTrail(chatId)` returns `{ trail, show }`; draw a `SubagentTimeline` for the last step as the [timeline's](/agents-react/chat/timeline#props) overlay.

`SubagentTimeline({ chatId, toolUseId })` reads the conversation with `chat.subagent` and follows it while it grows. It is read-only and draws no prompt cards; the main composer answers the child's approvals and questions. A nested subagent opens one step further down.

Outside the chat's own place, such as in a panel beside it, pass `info={false}` to leave out the header and its way back through the chat's trail. Pass `onOpenConversation(step)` to open a nested subagent in that panel's own trail; without it, the step goes onto the chat's trail.

`SubagentInfo({ chatId, toolUseId })` is the header: state, time, model, spend, and the task behind a fold.

## Workflows

A Workflow call is a row of its own in the thread (`WorkflowRow`): its phases, the agents it started in each and what they do. An agent has no call of its own, so its conversation is named `workflowAgentRef(agentId)`; a `SubagentTimeline` with that id reads it like any other.

For a view of a workflow outside the thread, the helpers in `@adecore/agents-react/chat` read it the way the row does. `workflowPhases(workflow, running)` answers a `WorkflowPhaseView` per phase in the script's order, each with a `WorkflowAgentView` per agent, and agents of no known phase first under the key `loose`; pass the call's `state === 'running'` as `running`, since the call's state, not a stall warning, says whether the workflow lives. `workflowAgentState(agent, running)` is a `WorkflowAgentState`: `running`, `waiting`, `stopped`, `done` or `failed`. `workflowCounts(phases)` counts the agents by state (`WorkflowCounts`), `workflowAgentTime(view)` is the time an agent's line shows, `workflowAgentPreview(view)` its second line (`WorkflowAgentPreview`), and `workflowDescription(input)` the description in the script's `meta`.

`workflowPhaseState(phase)` is a `WorkflowPhaseState`: a `WorkflowPhaseStateKind` (`running` while an agent of it is at work or some settled and others wait, `waiting` before any started, then `done`, or `failed` when one failed or stopped), with how many of its agents `settled` of the `total`. `workflowPhaseTime(phase)` is a `WorkflowPhaseTime` from the first start to the last known end, with `endedAt` null while an agent is at work; agents of a phase run beside each other, so it is never their sum. `liveWorkflowPhase(phases, running)` is the key of the phase to keep open by itself: the one with an agent at work, the one whose agent started last when several are, before that the first that waits, and null once the workflow stopped running.

`WorkflowAgentLine({ view, provider, onOpen?, selected?, className?, ref? })` is the row's line for one agent, for a list of your own: it opens the agent's conversation through `onOpen` once the agent started, carries `data-workflow-agent` with the agent's index, and `selected` marks the one whose conversation is open (`aria-pressed`).

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
