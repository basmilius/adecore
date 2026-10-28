# Durations

How long something took, how long it has been running, how long is left, and how long ago it was.

```ts
import { formatAgo, formatClockDuration, formatCountdown, formatDuration, formatElapsedShort, formatPreciseDuration } from '@adecore/ui/format';
```

<Demo src="formatting/durations" />

Every function takes milliseconds.

| Function | Writes |
| --- | --- |
| `formatDuration(ms)` | A duration in its coarsest useful unit: `42 s`, `18 min`, `1.5 h`. |
| `formatPreciseDuration(ms)` | A short measurement, below a second too: `0.4 ms`, `123 ms`, `1.42 s`, then as `formatDuration` from a minute. 999.6 ms reads as `1 s`. |
| `formatCountdown(ms)` | Time left, compact: `4d 3h`, `12h 8m`, `9m`. |
| `formatElapsedShort(ms)` | Running time in at most two units: `12s`, `2m 5s`, `3h 20m`. Anything above zero reads at least `1s`. |
| `formatClockDuration(ms)` | A stopwatch: `00:14`, or `1:02:03` past an hour. |
| `formatAgo(ms)` | Time ago, compact: `now`, `3m ago`, `2d ago`. |

The first five use English unit abbreviations; only the number follows the region (`1,5 h` or `1.5 h`). `formatAgo` follows the language entirely: `3 min. geleden` in Dutch.

To keep a running duration current, redraw it with [`useNow`](/ui/hooks/use-now), or write it into the node with `useTickingText`.
