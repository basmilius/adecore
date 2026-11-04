# Tasks and worktrees

## Tasks

A task is work a chat asked of a chat it opened. The host keeps it where no agent can write (see [Coordination](/agents/coordination)). These are the records.

```ts
import { TaskSchema, type Task } from '@adecore/agent-contracts/task';
```

| Field                                | Meaning                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `parentId`, `childId`, `projectId`   | Who asked, who works on it, and where.                                                                    |
| `title`, `prompt`                    | What was asked.                                                                                           |
| `status`                             | A `TaskStatus` (`TaskStatusSchema`): `open`, `done`, `failed` or `cancelled`.                             |
| `result`                             | A `TaskResult` (`TaskResultSchema`), `{ text, source, at }`, `null` while open. `source` is `done` (the child said so), `turn` (its first turn ended) or `exit` (its process left). |
| `wake`                               | Whether the parent was told: `pending`, `sent`, or `none` for a task that wakes nobody.                   |
| `batchId`                            | Tasks asked in one call. The parent wakes once all settled.                                               |
| `background`, `requiresTaskTurn`     | Work that keeps the task open after the turn, and an assignment that still owes the child a turn.         |
| `paused`                             | `{ kind: 'usage' \| 'overload', until? }` while the child waits out a limit. The task stays open.          |
| `machine`                            | The child's machine when it is another one. No local chat settles the task.                               |

An idle child has not necessarily finished, so read `status`. `TaskChangedEventSchema` (`TaskChangedEvent`) is `{ task }`, for an app that sends task changes over its own protocol. The agent event table does not carry it.

## Worktrees

`WorktreeSchema` (`Worktree`) is a git worktree: `path`, `branch`, and for host-made ones the source (`from`), project, node and creation time. `missing` means git knows the worktree but the folder is gone. `locked` means removing it takes force.

`WorktreeWorkSchema` (`WorktreeWork`) is what a worktree holds that its branch lacks: `changed` tracked files, `untracked` files, commits `ahead`, and an unfinished rebase or merge (`operation`). `behind` counts commits the branch gained since, which is not work. The schemas describe a worktree but check nothing on disk.

