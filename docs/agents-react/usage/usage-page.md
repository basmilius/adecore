# UsagePage

What the agent CLIs of a host cost over a period: a total, a chart per day or hour, token tiles, a breakdown by model, folder and day, and the plan limits. The host scans the transcripts; the page only asks.

```tsx
import { UsageDialog, UsagePage } from '@adecore/agents-react/usage';
```

<Demo src="agents/usage-page" />

```tsx
<UsageDialog open={open} onOpenChange={setOpen}>
    <ErrorBoundary label="Usage">
        <UsagePage key={scope.id} />
    </ErrorBoundary>
</UsageDialog>
```

`UsageDialog` is the frame; its content mounts only while open. `UsagePage` is the body and reads the host of its scope. Give it a `key` per host, since a picked account belongs to one host.

## What it asks

While mounted, the page sends `usage.subscribe`, asks `usage.summary` for the period on screen, asks again on every `usage.changed`, and sends `usage.unsubscribe` on unmount. A failed request keeps the old numbers and says so. Without a connection it shows the last numbers or an empty state.

| Choice   | Values                                                  | Kept      |
| -------- | ------------------------------------------------------- | --------- |
| Period   | `today` (per hour), `7d`, `30d`, `90d` (per day)        | Yes, `7d` |
| Metric   | `cost`, `tokens`                                        | Yes, `cost` |
| Currency | `USD`, `EUR` at the rate the summary carries            | Yes, `USD` |
| Account  | All, or one account once a CLI has several              | No        |

The period follows the viewer's calendar days and time zone. `windowFor(period)` builds that window.

## Props

| Prop      | Type                             |                                                                                          |
| --------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `pickers` | `ReactNode`                      | Controls of your own, first in the header, such as a picker of the host.                 |
| `notice`  | `(stale: boolean) => ReactNode`  | A line over the numbers about the host; `stale` is true while older numbers show. |

## UsagePane

The usage section of the settings dialog: the currency and a button to the page. `onOpenPage` lets your app swap the settings for the usage dialog.

<Demo src="agents/usage-pane" />

```tsx
<UsagePane onOpenPage={() => openUsage()} />
```

## State

`useUsageStore` holds the three [stored](/agents-react/guide/persistence) choices and, per scope, the summary, its request, its loading or failed state and the plan limits. `askedKey(payload)` is a summary's key.
