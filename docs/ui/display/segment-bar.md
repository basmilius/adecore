# SegmentBar

A whole split into parts, each as wide as it lasts, so a person compares them at a glance: the sections of a song, the steps of a job, what fills a budget.

```tsx
import { SegmentBar } from '@adecore/ui';
```

<Demo src="display/segment-bar" />

The parts follow each other from 0, each as long as its `value`. Their bounds line up with anything drawn over the same stretch, such as the marks of a [`Waveform`](/ui/display/waveform). A very narrow part may not show.

A part with its own `start` begins there, and the stretch before it stays empty. The parts still go in order.

`range` sets the stretch the bar shows, by default 0 to the end of the last part. A longer range leaves the rest empty, so bars side by side compare by eye. A shorter one shows the visible part of a zoomable timeline.

```tsx
<SegmentBar label="Sections" parts={[{ value: 12, label: 'Intro' }, { value: 36, label: 'Verse', current: true }]} range={[0, 110]} />
<SegmentBar label="Scenes" parts={[{ start: 8, value: 30, label: 'Interview' }, { start: 46, value: 22, label: 'B-roll' }]} range={[0, 110]} />
```

The default size draws each label in its part, cut short where it does not fit, with a [`Tooltip`](/ui/overlays/tooltip) for the whole label. `size="sm"` is a thin bar that shows labels only as a tooltip.

A part takes the theme's color, or any CSS color in `color`, such as `var(--positive)`. `current` draws a part in the accent; `color` wins over it.

With `onSelect` every part is a button that passes its index in `parts`. Give every part a `label` then, as the button's name.

A screen reader hears the parts as a list, by label, with the current one marked. A bar without labels and `onSelect` is hidden from it, so name the whole on the element around it.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `parts` | `readonly SegmentBarPart[]` | | Required. |
| `range` | `readonly [from: number, to: number]` | 0 up to the end of the last part | The stretch it shows, in the unit of the parts. |
| `size` | `'sm' \| 'md'` | `'md'` | `sm` is thin without visible labels. |
| `onSelect` | `(index: number) => void` | | Makes every part a button. |
| `label` | `string` | | The name of the whole. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLOListElement>` | | |

A `SegmentBarPart` has these fields:

| Field | Type | |
| --- | --- | --- |
| `value` | `number` | Required. Its length, in the unit of `range`. |
| `start` | `number` | Where it starts, in the unit of `range`. Defaults to the end of the part before, or 0. |
| `label` | `string` | Drawn where there is room, and always read by a screen reader. |
| `color` | `string` | Any CSS color in place of the theme's. |
| `current` | `boolean` | The part a person is at. |

`SegmentBarProps` and `SegmentBarPart` are exported types.
