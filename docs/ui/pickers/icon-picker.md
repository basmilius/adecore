# IconPicker

Picks an icon from a set of Lucide icons. The trigger looks like a field under a label and shows the chosen icon and its name, or "None". A click opens a popover with an icon grid. Each icon's name is its tooltip and accessible name.

```tsx
import { IconPicker } from '@adecore/ui';
```

<Demo src="inputs/icon-picker" />

Choosing an icon closes the popover and focuses the trigger. The grid is one tab stop. Arrow keys move focus, Home and End jump to the first and last icon, and only Enter, Space or a click chooses.

## Groups and search

Pass `icons` a list of `IconPickerGroup`s, each `{ id, label, icons }` with a translated label. Each group gets a heading with its icon count. Groups add a search field, focused on open; `searchable` turns it off, or on for a flat set. Escape clears the search first, then closes.

A search matches part of an icon's name, its `keywords`, or a group's label (keeping the whole group), ignoring case. Empty groups are hidden, and an empty result says so.

With `rows`, the grid scrolls at that many rows high, so the popover keeps its height during a search. Headings stick to the top, and the chosen icon opens centered.

<Demo src="inputs/icon-picker-groups" />

With `onClear`, a "No icon" button under the grid clears the icon. Leave it out when the thing has a default icon. The label defaults to "Icon" (`iconPicker.label`).

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `icons` | `Readonly<Record<string, LucideIcon>> \| readonly IconPickerGroup[]` | | Required. Every icon by its name, in the order of the grid, or in groups. |
| `value` | `string \| null` | | Required. The name of the picked icon. |
| `onValueChange` | `(name: string) => void` | | Required. |
| `keywords` | `Readonly<Record<string, readonly string[]>>` | | More words a search finds an icon by, by icon name. |
| `searchable` | `boolean` | `true` for groups | A search field above the grid. |
| `rows` | `number` | | The height of the scroll area in rows. Without it the grid is as tall as its icons. |
| `onClear` | `() => void` | | Offers "No icon" under the grid, and a clear button beside the trigger while an icon is chosen. |
| `label` | `string` | "Icon" | The label above the trigger. |
| `hideLabel` | `boolean` | `false` | Keeps the label for assistive technology only. |
| `disabled` | `boolean` | `false` | The trigger does not open. |
| `className` | `string` | | On the box around the label and the trigger. |
| `ref` | `Ref<HTMLDivElement>` | | The same box. |

`IconPickerProps` and `IconPickerGroup` are exported types.
