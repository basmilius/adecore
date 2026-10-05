# Usage

Usage views display summaries and limits reported by the backend. They do not scan transcripts or fetch plan credentials in the browser. Prices and scan provenance belong to that response; estimates are not a billing statement.

## Mount only while viewing

`UsageDialog` controls a large dialog frame. `UsagePage` is its body and reads the current `ChatScope`. Put an error boundary around the page and remount it when changing hosts so an account filter from one backend cannot carry into another.

```tsx
import { ErrorBoundary } from '@adecore/ui';
import { ChatScopeContext, type ChatScope } from '@adecore/agents-react/scope';
import { UsageDialog } from '@adecore/agents-react/usage/UsageDialog';
import { UsagePage } from '@adecore/agents-react/usage/UsagePage';

export function HostUsage({ scope, open, onOpenChange }: { scope: ChatScope; open: boolean; onOpenChange(open: boolean): void }) {
    return (
        <UsageDialog open={open} onOpenChange={onOpenChange}>
            <ChatScopeContext.Provider value={scope}>
                <ErrorBoundary label="Usage">
                    <UsagePage key={scope.id} notice={(stale) => (stale ? <p>Showing the last received summary.</p> : null)} />
                </ErrorBoundary>
            </ChatScopeContext.Provider>
        </UsageDialog>
    );
}
```

`pickers` inserts host controls in the header. `notice(stale)` receives true whenever a matching summary is displayed, including while refreshing or disconnected. Combine it with host connection state to decide whether to show a stale-data notice. `UsagePane({ onOpenPage })` integrates currency selection and navigation into settings. `UsageLimitsCard` wraps a host trigger element for a compact limits popup.

## Requests and subscriptions

While mounted, the page asks `usage.subscribe`, listens to `usage.changed`, and reads `usage.summary`. It reestablishes the subscription on open connections and sends `usage.unsubscribe` when unmounted. A custom transport must notify status subscribers; changing its `status` silently leaves the views stale.

`useUsageStore.byScope` holds a summary, its request key, loading/failure flags, and limits for each backend. `askedKey(payload)` includes the date range, resolution, time zone, and accounts. The page displays only a summary matching the current request key. A response for an older range is therefore not presented as the new range. Requests have no `AbortSignal`, and the underlying adapter owns actual cancellation.

A failed request marks the row failed and keeps its previous summary. A closed connection leaves old matching numbers available under the host notice. Without any known numbers the view displays an empty state, rather than waiting forever for a disconnected host.

## Periods, currency, and account filters

| Choice   | Values and defaults                                 |
| -------- | --------------------------------------------------- |
| Period   | `today`, `7d` (default), `30d`, `90d`               |
| Metric   | `cost` (default), `tokens`                          |
| Currency | `USD` (default), `EUR`                              |
| Account  | Null for all accounts; one account ID when narrowed |

`windowFor(period, now)` uses the viewer's calendar dates and time zone, falling back to UTC if unavailable. Today requests hourly buckets; other periods request daily buckets. `summaryPayload` adds the account filter only when supplied. The host must honor the payload's time zone when bucketing.

The cost source is USD. EUR display uses the rate in the summary and explains missing or dated conversion data. `deriveUsage` prepares chart slots, provider totals, and cache savings. The page lists scan time/file count and whether prices were fetched or bundled. Missing transcript roots are an empty-state condition, not proof of zero spending.

Only period, metric, and currency persist. The selected host, account filter, summaries, failure flags, and limits do not. `reloadUsagePreferences()` changes the remembered choices without erasing current per-scope data. See [persistence](./persistence#record-formats).

## Plan limits and continuation

`useUsageLimits()` shares one limits read and event subscription per scope while views consume it. It asks `usage.limits` on an open connection and follows `usage.limitsChanged`; it never opens a connection itself. Releasing the last reader unsubscribes. Use one stable live transport for a scope ID.

`useLimitGroups`/`limitGroups` attach the scope's account labels to windows. `LimitsList` and `AccountLimitsList` render reset windows, availability, and remaining room. Unknown/unread limits are not usable capacity. `continueTarget` offers another enabled, signed-in account with known room, preferring its least-used session window; it never switches an account automatically.

The chat's `LimitDock` and `LimitPill` use its current limit/resume information. `ChatHost.useResumeAtReset(scopeId)` defaults true, but the backend owns scheduling and must apply host policy. The host controls whether a person may invoke continuation. See the [settings reference](./reference-settings) for individual chart and limit renderers.
