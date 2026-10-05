# IconPicker

The mark a thing wears, picked from a set of Lucide icons, as a grid under a label. Every icon's name is its tooltip and its accessible name.

```tsx
import { IconPicker } from '@adecore/ui';
```

<Demo src="inputs/icon-picker" />

The grid is one tab stop. The arrow keys move the focus (up and down by what is drawn above and below, across groups), Home and End go to the first and the last icon, and only Enter, Space or a click chooses. A surface that saves every choice at once never saves one the arrows passed.

## Groups and search

Hand `icons` a list of `IconPickerGroup`s, each `{ id, label, icons }` with the label already in the reader's language, and every group gets a heading with the number of icons it shows. Groups bring a search field, which `searchable` turns off, or on for a flat set. The search and the grid then share one frame, which wears the focus outline while the search has it. Escape empties a search that holds text before it can close a dialog.

A search matches part of an icon's name, of a word in `keywords` for that icon, or of a group's label, which keeps the whole group, whatever the case. A group without a match is left out, and when nothing matches the grid says so.

With `rows`, the grid is a scroll area that many rows high plus room for one heading, so the frame keeps its height through a search. The headings stick to its top, and the area opens with the chosen icon in the middle.

<Demo src="inputs/icon-picker-groups" />

With `onClear`, a button beside the label clears the icon. Leave it out when the thing falls back to a default icon of its own. The label defaults to "Icon" (`iconPicker.label`); give it another name when the same surface also takes a picture, or the two read as one list.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `icons` | `Readonly<Record<string, LucideIcon>> \| readonly IconPickerGroup[]` | | Required. Every icon by its name, in the order of the grid, or in groups. |
| `value` | `string \| null` | | Required. The name of the picked icon. |
| `onValueChange` | `(name: string) => void` | | Required. |
| `keywords` | `Readonly<Record<string, readonly string[]>>` | | More words a search finds an icon by, by icon name. |
| `searchable` | `boolean` | `true` for groups | A search field above the grid. |
| `rows` | `number` | | The height of the scroll area in rows. Without it the grid is as tall as its icons. |
| `onClear` | `() => void` | | |
| `label` | `string` | "Icon" | |
| `disabled` | `boolean` | `false` | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

`IconPickerProps` and `IconPickerGroup` are exported types.
