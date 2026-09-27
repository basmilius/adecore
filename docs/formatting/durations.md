# Durations

How long something took, how long it has been running, how long is left, and how long ago it was.

```ts
import { formatAgo, formatClockDuration, formatCountdown, formatDuration, formatElapsedShort } from '@basmilius/react-ui/format';
```

<Demo src="formatting/durations" />

Every function takes milliseconds.

| Function | Writes |
| --- | --- |
| `formatDuration(ms)` | How long something took, at the coarsest unit that still says something: `42 s`, `18 min`, `1.5 h`. |
| `formatCountdown(ms)` | How long a window still has, tight enough for the end of a bar: `4d 3h`, `12h 8m`, `9m`. |
| `formatElapsedShort(ms)` | How long something has been running, in two units at most: `12s`, `2m 5s`, `3h 20m`. Anything above zero reads as at least `1s`. |
| `formatClockDuration(ms)` | A stopwatch someone watches while it runs: `00:14`, and `1:02:03` past an hour. |
| `formatAgo(ms)` | How long ago, short enough for the right edge of a row: `now`, `3m ago`, `2d ago`. |

The units of the first four are English abbreviations, the way the rest of the interface is written. Only the number follows the region, which is what `1,5 h` against `1.5 h` is about. `formatAgo` is words as much as a number, so the language writes all of it: `3 min. geleden` in Dutch.

To keep a duration current while it runs, redraw it on a clock with [`useNow`](/hooks/use-now), or write it straight into the node with `useTickingText`.
