# useNow and useTickingText

A clock for a surface that says how long something has been running.

```tsx
import { useNow, useTickingText } from '@adecore/ui';
```

<Demo src="hooks/use-now" />

## useNow

`useNow(intervalMs, ticking = true)` returns the time in epoch milliseconds and renders again every `intervalMs` while `ticking` is true. Each call starts its own timer, so call it once for a surface and hand the time to its rows.

## useTickingText

`useTickingText(render, intervalMs = 1000)` writes the text straight into a `<span>` and returns the ref to put on it, without re-rendering. Use it for a timer on each row of a long list.

```tsx
const ref = useTickingText(() => formatElapsedShort(Date.now() - startedAt));

return <span ref={ref} />;
```

It also writes after every render, so the first render shows the text.
