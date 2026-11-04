# Usage

A host reads what the CLIs cost from their transcripts and asks each plan how much of its limits is left. These are the shapes of both answers. [`@adecore/agents`](/agents/usage) produces them, and the [usage page](/agents-react/usage/usage-page) draws them.

## Token totals

```ts
import { addTotals, EMPTY_TOTALS, totalTokensOf } from '@adecore/agent-contracts/usage';

const totals = addTotals(EMPTY_TOTALS, { calls: 1, input: 10, cacheRead: 20, cacheWrite: 30, cacheWrite1h: 5, output: 40, reasoning: 8 });

totalTokensOf(totals); // 100
```

`UsageTotals` (`UsageTotalsSchema`) holds `input` (uncached), `cacheRead`, `cacheWrite` and `output`. `cacheWrite1h` is part of `cacheWrite`, and `reasoning` part of `output`. `totalTokensOf` adds the four that do not overlap. `addTotals` returns a new object.

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

Both dates are inclusive and read in `timeZone`, an IANA name, because the host may run elsewhere. The schema does not check that dates or zone exist. `resolution` is a `UsageResolution` (`UsageResolutionSchema`), `hour` or `day`. `accounts` narrows the summary to those accounts and splits every bucket and model per account. `UsageProviderSchema` and `USAGE_PROVIDERS` list the providers whose usage a host reads.

`UsageSummaryResult` holds:

| Field | Type | Holds |
| --- | --- | --- |
| `buckets` | `UsageBucket` (`UsageBucketSchema`) | One per slot, provider and model (and account), with totals, `costUsd`, `cacheSavingsUsd` and `sessions`. A slot is `YYYY-MM-DD` for a day or an ISO hour start, in the requested zone. |
| `models` | `UsageModel` (`UsageModelSchema`) | Totals and cost per model, with `priceBasis` and `pricedAs`, what the price matched on. The basis is a `UsagePriceBasis` (`UsagePriceBasisSchema`): `exact`, `family`, `override` or `unknown`. |
| `projects` | `UsageProject` (`UsageProjectSchema`) | Usage per folder, with a `projectId` when the folder is a known project. |
| `sessions` | A number | Distinct sessions over the whole period. Sessions span days and models, so buckets do not add up to it. |
| `scan` | `UsageScan` (`UsageScanSchema`) | When the last scan ran, how many files it read and changed, whether one runs now and whether it failed. |
| `pricing` | `UsagePricing` (`UsagePricingSchema`) | The price `source` (`litellm`, `snapshot` or `none`), when it was fetched and how many models it prices. |
| `roots` | `UsageRoot` (`UsageRootSchema`) | Each transcript folder with its provider and `status`: `ok`, `missing` or `failed`. |
| `rate` | `UsageRate` (`UsageRateSchema`) | A dated reference rate from dollars to another currency, or `null`. |
| `accounts` | `UsageAccount` (`UsageAccountSchema`) | Every account a record names, removed ones included. |

A `costUsd` of `null` means the price is unknown, not free. `usage.changed` carries only `scannedAt`, so a client requests its period again.

## Plan limits

`UsageLimitsSnapshot` is `{ providers }`. Each is a `UsageLimitsProvider` (`UsageLimitsProviderSchema`), one per CLI and account, with `plan`, `windows`, session `cost` and an `unavailable` reason. A window is a `UsageWindow` (`UsageWindowSchema`): a session, weekly, monthly or other limit with `used` as a fraction from 0 to 1, plus `resetsAt` and `durationMs` (`null` when unknown). `source` is `probe` (the host's own check) or `event` (a running turn). `unavailable.reason` is `not-installed`, `no-subscription` or `failed`.

```ts
import { evenPace } from '@adecore/agent-contracts/usage';

evenPace(window, now); // { percent: 40, standing: 'ahead' } two hours into a five hour window at 60% used
```

`evenPace(window, now)` returns an `EvenPace`, where an evenly spent window would stand: `percent` in whole percent, and a `standing` (`PaceStanding`) of `ahead`, `behind` or `even`. It returns `null` without `resetsAt` or `durationMs`.

A missing reading is unknown, not room left. A chat's `ChatUsage` is different: one chat's context and cost as its CLI reported it, while a summary comes from transcripts priced by the host.
