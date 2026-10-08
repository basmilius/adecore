# SlidingColumn

A panel that slides in and out along the right edge of a view, with a left edge a person drags to resize it. It draws a border along that edge on the surface ground.

```tsx
import { SlidingColumn } from '@adecore/ui';
```

<Demo src="layout/sliding-column" fill />

The outer column is 0 pixels wide and inert while closed. The contents sit in an inner column of the stored width, so they do not reflow while the column moves, and they stay mounted until the slide is over, so a close plays out. Only the width animates, in 200 milliseconds, and never while a person drags it.

You keep the width. `onWidthChange` hands you every size during a drag, a whole number already held between `bounds.min` and `bounds.max()`. Clamp a stored width yourself before you pass it in, with [`clampColumnSize`](/ui/hooks/use-column-resize#clampcolumnsize), since only you know what has to stay beside the column.

`instant` lands the width without the motion, for a column whose place is restored as the page loads. Only what a person does afterwards should animate.

## Space between panels

Set `gap={8}` to replace the left border with eight pixels of space in `--separator`. The resize handle fills that space. `width`, `bounds`, and `onWidthChange` describe the surface alone; the open column occupies `width + gap` pixels. A closed column still takes no space. Leaving `gap` at zero preserves the border and existing layout.

## A column with shortcuts

`body` hands the column the keyboard, for a panel with shortcuts of its own. The inner column becomes focusable by script (`tabIndex={-1}`), so opening something in it can move focus there without a click first, and its `onKeyDown` hears the keys while focus is inside.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `open` | `boolean` | | Required. |
| `width` | `number` | | Required. In pixels, already clamped. |
| `gap` | `number` | `0` | Space before the surface, in whole pixels. |
| `bounds` | `{ min: number; max(): number }` | | Required. `max` is read at drag time, so a window resize between two drags counts. |
| `onWidthChange` | `(width: number) => void` | | Required. |
| `instant` | `boolean` | `false` | |
| `body` | `{ ref: RefObject<HTMLDivElement \| null>; onKeyDown(event): void }` | | |
| `children` | `ReactNode` | | |
| `className` | `string` | | On the outer column. |
| `ref` | `Ref<HTMLElement>` | | The outer column, for bounds that measure what is beside it. |

`SlidingColumnProps` is an exported type.
