# SegmentBar

A whole split into parts, each as wide as it lasts, so a person compares them at a glance: the sections of a song, the steps of a job, what fills a budget.

```tsx
import { SegmentBar } from '@basmilius/desktop-ui';
```

<Demo src="display/segment-bar" />

The parts follow each other from 0, each as long as its `value`. Every part starts exactly at its place, so the bounds line up with anything else drawn over the same stretch, such as the marks of a [`Waveform`](/display/waveform). The gap between two parts that touch comes out of the one before, and a part far too narrow for anything may not show at all.

A part with a `start` of its own begins there instead of where the part before it ends, and the stretch in between stays empty: no fill, no button and nothing a screen reader hears. That places the sections of a timeline where they fall, with room before, between or after them. The parts still go in order.

`range` sets the stretch the bar shows. Without it the bar runs from 0 to the end of the last part. A longer range leaves the rest of the bar empty, so bars side by side compare by eye; a shorter one shows the visible part of a timeline that zooms and scrolls, with the parts at its edges cut off.

```tsx
<SegmentBar label="Sections" parts={[{ value: 12, label: 'Intro' }, { value: 36, label: 'Verse', current: true }]} range={[0, 110]} />
<SegmentBar label="Scenes" parts={[{ start: 8, value: 30, label: 'Interview' }, { start: 46, value: 22, label: 'B-roll' }]} range={[0, 110]} />
```

The default size draws each label in its part and cuts a label short where it does not fit; a [`Tooltip`](/overlays/tooltip) then shows it whole. `size="sm"` is a thin bar for a progress row or a meter, which shows its labels only as a tooltip.

A part wears the theme's color, or any CSS color in `color`, such as `var(--positive)` for a step that is done. `current` marks the part a person is at in the accent, and a `color` wins over it.

With `onSelect` every part is a button, which calls it with the part's index in `parts`: to jump to a section, or to point at one. Give every part a `label` then, since it is the name of its button.

The bar is a list, so a screen reader hears the parts in order, by their labels, and hears which one is current. A bar whose parts have no label and no `onSelect` is hidden from a screen reader: name the whole on the element around it, such as a meter with its value.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `parts` | `readonly SegmentBarPart[]` | | Required. |
| `range` | `readonly [from: number, to: number]` | 0 up to the end of the last part | The stretch it shows, in the unit of the parts. |
| `size` | `'sm' \| 'md'` | `'md'` | `sm` is 6 pixels high without visible labels, `md` 28 pixels with them. |
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
