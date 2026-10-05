# useContentSize

The size of an element's content box, in whole pixels, kept current with a `ResizeObserver`. `useMeasuredWidth` is the same for the width alone.

```tsx
import { useContentSize, useMeasuredWidth } from '@adecore/ui';
```

<Demo src="hooks/use-content-size" />

Both return a callback ref and the size. Put the ref on the element to measure:

```tsx
const [measure, { width, height }] = useContentSize();

return <div ref={measure}>{width > 0 && <Plot width={width} height={height} />}</div>;
```

The size is rounded, so a frame fitted into the space lands on whole pixels too, and a chart that draws in real pixels keeps every line sharp. The size is `0` by `0` until the element is there.

`ContentSize` (`{ width, height }`) is an exported type.
