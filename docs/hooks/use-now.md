# useNow and useTickingText

A clock for a surface that says how long something has been running.

```tsx
import { useNow, useTickingText } from '@basmilius/desktop-ui';
```

<Demo src="hooks/use-now" />

## useNow

`useNow(intervalMs, ticking = true)` answers the time in epoch milliseconds and draws the component again every `intervalMs`. One timer serves the whole surface, and it runs only while `ticking` is true, so a list with nothing running costs nothing. It starts at the moment the component mounts, so a panel that comes back halfway through does not read zero for a second.

## useTickingText

`useTickingText(render, intervalMs = 1000)` writes the text straight into a node and answers the ref to put on it. Nothing re-renders. Use it for a timer on one line of a long list or a thread, where re-rendering every row each second would cost more than the timer is worth.

```tsx
const ref = useTickingText(() => formatElapsedShort(Date.now() - startedAt));

return <span ref={ref} />;
```

It writes after every render as well, so the first render already shows the text, and a language or region change lands without waiting for the next tick.
