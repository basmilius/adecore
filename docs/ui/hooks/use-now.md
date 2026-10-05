# useNow and useTickingText

A clock for a surface that says how long something has been running.

```tsx
import { useNow, useTickingText } from '@adecore/ui';
```

<Demo src="hooks/use-now" />

## useNow

`useNow(intervalMs, ticking = true)` returns the time in epoch milliseconds and draws the component again every `intervalMs`. Each call starts its own timer, so call it once for a surface and hand the time to its rows. The timer runs only while `ticking` is true, so a list with nothing running costs nothing. The first value is the time of mounting, so a panel that comes back halfway through never reads zero.

## useTickingText

`useTickingText(render, intervalMs = 1000)` writes the text straight into a `<span>` and returns the ref to put on it. Nothing re-renders. Use it for a timer on one line of a long list or a thread, where re-rendering every row each second would cost more than the timer is worth.

```tsx
const ref = useTickingText(() => formatElapsedShort(Date.now() - startedAt));

return <span ref={ref} />;
```

It writes after every render as well, so the first render already shows the text, and a language or region change lands without waiting for the next tick.
