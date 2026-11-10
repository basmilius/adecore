# Plan limits

What is left of each plan: the session and weekly windows of every CLI and account, as the host last read them.

```tsx
import { UsageLimits, UsageLimitsCard } from '@adecore/agents-react/usage';
```

<Demo src="agents/usage-limits" />

`UsageLimits()` is the usage page's section: a card per account with a bar and reset time per window, or why an account has no numbers, with sign-in when the host has `openLogin`. It reads the scope in context.

`UsageLimitsCard({ side, open, children })` shows the same numbers in a hover card over your own trigger. It asks the host only once opened. `side` is `'top'` by default; `'left'` opens it beside a trigger at the window's right edge. `open` holds the card open while it is `true`, beside the hover, such as while a key of your own is down.

```tsx
<UsageLimitsCard>
    <Button variant="secondary">Plan limits</Button>
</UsageLimitsCard>
```

## Reading the limits

`useUsageLimits()` returns the scope's `UsageLimitsSnapshot`, or `null` until the host answers. All views of a host share one read of `usage.limits`, following `usage.limitsChanged`.

`useLimitGroups(limits)` groups the windows per CLI with the scope's accounts, one group per CLI, so a signed-out account still gets a row; `limitGroups(snapshot, accounts)` does it outside React. A window without a reading is unknown, not room left.

## Lists

`LimitsList({ limits, now, compact? })` lists every CLI with its windows; `compact` suits a hover card. `AccountLimitsList({ groups, now, folded, onFoldedChange })` is a flat list of accounts for a hover card, each folding to a ring per window; the caller holds which are folded. `WindowBar({ window, now, compact })` is one bar with usage and reset time.

A window with a reset and a length marks where an even pace would stand by now, and its `aria-valuetext` says whether usage is ahead or behind. `evenPace(window, now)` from [`@adecore/agent-contracts/usage`](/agent-contracts/usage) returns the mark in whole percent and `ahead`, `behind` or `even`, or `null` without timing.
