# SlidingColumn

A panel that slides in and out along the right edge of a view, with a left edge a person drags to resize it.

```tsx
import { SlidingColumn } from '@basmilius/desktop-ui';
```

<Demo src="layout/sliding-column" fill />

The outer column is 0 pixels wide and inert while closed. The contents sit in an inner column of the stored width, so they do not reflow while the column moves, and they stay mounted until the slide is over, so a close plays out. Only the width animates, in 200 milliseconds, and never while a person drags it.

You keep the width. `onWidthChange` hands you every size during a drag, already held between `bounds.min` and `bounds.max()`. Clamp a stored width yourself before you pass it back in, with [`clampColumnSize`](/hooks/use-column-resize), since only you know what has to stay beside the column.

`instant` lands the width without the motion, for a column whose place is restored as the page loads. Only what a person does afterwards should animate.

## A column with shortcuts

`body` hands the column the keyboard, for a panel with shortcuts of its own. The inner column becomes focusable by script (`tabIndex={-1}`), so opening something in it can move focus there without a click first, and its `onKeyDown` hears the keys while focus is inside.

## Props

| Prop | Type | |
| --- | --- | --- |
| `open` | `boolean` | Required. |
| `width` | `number` | Required. |
| `bounds` | `{ min: number; max(): number }` | Required. `max` is read at drag time, so a window resize between two drags counts. |
| `onWidthChange` | `(width: number) => void` | Required. |
| `instant` | `boolean` | |
| `body` | `{ ref: RefObject<HTMLDivElement \| null>; onKeyDown(event): void }` | |
| `children` | `ReactNode` | |
| `className` | `string` | On the outer column. |
| `ref` | `Ref<HTMLElement>` | The outer column, for bounds that measure what is beside it. |

`SlidingColumnProps` is an exported type.
