# Tasks and usage

## Tasks

A task is work a chat asked of a chat it opened. The host keeps it where no agent can write (see [Coordination](/agents/coordination)). These are the records.

```ts
import { TaskSchema, type Task } from '@adecore/agent-contracts/task';
```

| Field                                | Meaning                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `parentId`, `childId`, `projectId`   | Who asked, who works on it, and where.                                                                    |
| `title`, `prompt`                    | What was asked.                                                                                           |
| `status`                             | `open`, `done`, `failed` or `cancelled`.                                                                  |
| `result`                             | `{ text, source, at }`, `null` while open. `source` is `done` (the child said so), `turn` (its first turn ended) or `exit` (its process left). |
| `wake`                               | Whether the parent was told: `pending`, `sent`, or `none` for a task that wakes nobody.                   |
| `batchId`                            | Tasks asked in one call. The parent wakes once all settled.                                               |
| `background`, `requiresTaskTurn`     | Work that keeps the task open after the turn, and an assignment that still owes the child a turn.         |
| `paused`                             | `{ kind: 'usage' \| 'overload', until? }` while the child waits out a limit. The task stays open.          |
| `machine`                            | The child's machine when it is another one. No local chat settles the task.                               |

An idle child has not necessarily finished, so read `status`. `TaskChangedEventSchema` is `{ task }`, for an app that sends task changes over its own protocol. The agent event table does not carry it.

## Worktrees

`WorktreeSchema` is a git worktree: `path`, `branch`, and for host-made ones the source (`from`), project, node and creation time. `missing` means git knows the worktree but the folder is gone. `locked` means removing it takes force.

`WorktreeWorkSchema` is what a worktree holds that its branch lacks: `changed` tracked files, `untracked` files, commits `ahead`, and an unfinished rebase or merge (`operation`). `behind` counts commits the branch gained since, which is not work. The schemas only describe and check nothing on disk.

## Token totals

```ts
import { addTotals, EMPTY_TOTALS, totalTokensOf } from '@adecore/agent-contracts/usage';

const totals = addTotals(EMPTY_TOTALS, { calls: 1, input: 10, cacheRead: 20, cacheWrite: 30, cacheWrite1h: 5, output: 40, reasoning: 8 });

totalTokensOf(totals); // 100
```

`UsageTotals` holds `input` (uncached), `cacheRead`, `cacheWrite` and `output`. `cacheWrite1h` is part of `cacheWrite`, and `reasoning` part of `output`. `totalTokensOf` adds the four that do not overlap. `addTotals` returns a new object.

## Summaries

`usage.summary` asks for a period:

```ts
import { UsageSummaryPayloadSchema } from '@adecore/agent-contracts/usage';

const period = UsageSummaryPayloadSchema.parse({
    from: '2026-10-01',
    to: '2026-10-05',
    resolution: 'day',
    timeZone: 'Europe/Amsterdam',
    accounts: ['claude']
});
```

Both dates are inclusive and read in `timeZone`, an IANA name, because the host may run elsewhere. The schema does not check that dates or zone exist. `resolution` is `hour` or `day`. `accounts` narrows the summary to those accounts and splits every bucket and model per account. `UsageProviderSchema` and `USAGE_PROVIDERS` list the providers whose usage a host reads.

`UsageSummaryResult` holds:

- `buckets`: one per slot, provider and model (and account), with totals, `costUsd`, `cacheSavingsUsd` and `sessions`. A slot is `YYYY-MM-DD` for a day or an ISO hour start, in the requested zone.
- `models`: totals and cost per model, with `priceBasis` (`exact`, `family`, `override`, `unknown`) and `pricedAs`, what the price matched on.
- `projects`: usage per folder, with a `projectId` when the folder is a known project.
- `sessions`: distinct over the whole period. Sessions span days and models, so buckets do not add up to it.
- `scan`, `pricing`, `roots`: scan freshness, the price source (`litellm`, `snapshot` or `none`), and whether each transcript folder was readable.
- `rate`: a dated reference rate from dollars to another currency, or `null`.
- `accounts`: every account a record names, removed ones included.

A `costUsd` of `null` means the price is unknown, not free. `usage.changed` carries only `scannedAt`, so a client requests its period again.

## Plan limits

`UsageLimitsSnapshot` is `{ providers }`, one entry per CLI and account with `plan`, `windows`, session `cost` and an `unavailable` reason. A window is a session, weekly, monthly or other limit with `used` as a fraction from 0 to 1, plus `resetsAt` and `durationMs` (`null` when unknown). `source` is `probe` (the host's own check) or `event` (a running turn). `unavailable.reason` is `not-installed`, `no-subscription` or `failed`.

```ts
import { evenPace } from '@adecore/agent-contracts/usage';

evenPace(window, now); // { percent: 40, standing: 'ahead' } two hours into a five hour window at 60% used
```

`evenPace(window, now)` returns where an evenly spent window would stand: `percent` in whole percent, and a `standing` (`PaceStanding`) of `ahead`, `behind` or `even`. It returns `null` without `resetsAt` or `durationMs`.

A missing reading is unknown, not room left. A chat's `ChatUsage` is different: one chat's context and cost as its CLI reported it, while a summary comes from transcripts priced by the host.
