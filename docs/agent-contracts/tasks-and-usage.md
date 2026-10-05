# Tasks and usage

These contracts describe records and reports. The backend's [coordination modules](../agents/coordination) implement task lifetimes; the consumer owns placement, permissions, and notifications.

## Tasks and worktrees

`TaskSchema` stores project, parent, child, assignment, timing, status, result, and wake state. Status is `open`, `done`, `failed`, or `cancelled`. `TaskResult.source` distinguishes explicit completion (`done`), a turn result (`turn`), and process exit (`exit`). Result and settlement time are nullable while work is open.

`wake` is `pending`, `sent`, or `none`. A shared `batchId` groups completion wakes. Optional `requiresTaskTurn`, `background`, and `paused` preserve work awaiting assignment delivery, background settlement, or a usage/overload reset. Do not infer task completion from a child process being idle.

`TaskChangedEventSchema` wraps a whole task as `{ task }`. A consumer adds its event name to its own protocol; the agent event table does not register it.

`WorktreeSchema` describes a path and branch with optional creation provenance, project/node metadata, missing/locked flags, and inspected `work`. Legacy or manually created worktrees can lack all metadata. `WorktreeWorkSchema` counts changed tracked files, untracked files, and commits ahead. Optional `operation` describes an interrupted Git operation; `behind` is informational. Neither schema implements removal or validates a branch/path against the machine.

## Token accounting

```ts
import { EMPTY_TOTALS, addTotals, totalTokensOf, UsageSummaryPayloadSchema } from '@adecore/agent-contracts/usage';

const totals = addTotals(EMPTY_TOTALS, {
    calls: 1,
    input: 10,
    cacheRead: 20,
    cacheWrite: 30,
    cacheWrite1h: 5,
    output: 40,
    reasoning: 8
});
const tokens = totalTokensOf(totals);
const period = UsageSummaryPayloadSchema.parse({
    from: '2026-10-01',
    to: '2026-10-05',
    resolution: 'day',
    timeZone: 'America/New_York',
    accounts: ['claude']
});
```

`tokens` is 100. `cacheWrite1h` is a subset of `cacheWrite`, and reasoning is a subset of output. Counting either again would inflate the total. `addTotals` creates a new object without mutating either input. Treat `EMPTY_TOTALS` as a shared constant.

`UsageProviderSchema` and `USAGE_PROVIDERS` currently cover `claude` and `codex`. `UsageSummaryPayload` carries inclusive dates, `hour` or `day` resolution, an IANA time zone, and an optional account filter. The schema accepts strings for dates/time zone; it does not prove that a calendar date or IANA name is valid. Supply validated UI inputs.

## Summary and plan state

Summary buckets use viewer-local day or hour slots and include model/provider, totals, estimated cost, savings, and sessions. Optional account fields split buckets and models when account filtering is requested. A total session count is distinct over the entire period, so do not sum bucket session counts to reproduce it.

A model `costUsd: null` means no known price, not zero cost. `priceBasis` is `exact`, `family`, `override`, or `unknown`, with `pricedAs` explaining the match. The summary also reports scanner health, transcript root health, price source (`litellm`, `snapshot`, or `none`), optional known/removed account labels, and a nullable exchange rate. Rates convert dollars to the named currency and include their reference date.

`UsageLimitsSnapshot` contains provider/account readings. A window's `used` is a fraction from 0 to 1; format it as a percentage in the view. Reset time and duration can be null. `source` says whether the reading came from a probe or a running turn. `unavailable` distinguishes an absent installation, a nonsubscription account, and a failed check. A missing reading is not permission to resume a turn.

`ChatUsage` is per-chat context/cost/turn information. Machine usage summaries scan provider transcripts and may estimate pricing differently. Keep those two displays separate and show the reported source when presenting cost.
