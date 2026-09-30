# IconPicker

The mark a thing wears, picked from a set of Lucide icons, as a grid under a label. Every icon's name is its tooltip and its accessible name. The grid is one tab stop: the arrow keys move the focus, across groups by what is drawn above and below, Home and End go to the first and the last icon, and only Enter, Space or a click chooses, so a surface that saves every choice at once never saves one the arrows passed.

```tsx
import { IconPicker } from '@basmilius/desktop-ui';
```

<Demo src="inputs/icon-picker" />

## Groups and search

A long set reads better in groups. Hand `icons` a list of `IconPickerGroup`s, each `{ id, label, icons }` with its label already in the reader's language, and every group gets a heading with the number of icons it shows. Groups bring a search field, which `searchable` turns off or, for a flat set, on. The search and the grid then share one frame, the frame wears the focus outline while the search has it, and Escape empties a search that holds text before it reaches a dialog.

A search matches a part of an icon's name, of its group's label, or of a word in `keywords` for that icon, whatever the case. A group without a match goes; nothing at all says so in the grid.

With `rows`, the grid is a scroll area that many rows high, plus room for one heading, so the frame keeps its height through a search. The headings stick to its top, and the area opens with the chosen icon in the middle.

<Demo src="inputs/icon-picker-groups" />

With `onClear`, a button beside the label clears the icon. Leave it out when the thing falls back to a default icon of its own. The label defaults to the library's "Icon"; give it another name when the same surface also takes a picture, or the two read as one list.

## Props

| Prop | Type | |
| --- | --- | --- |
| `icons` | `Readonly<Record<string, LucideIcon>> \| readonly IconPickerGroup[]` | Required. Every icon by its name, in the order of the grid, or in groups. |
| `keywords` | `Readonly<Record<string, readonly string[]>>` | More words a search finds an icon by, by icon name. |
| `searchable` | `boolean` | A search field above the grid. On for groups, off for a flat set. |
| `rows` | `number` | The height of the scroll area in rows. Without it the grid is as tall as its icons. |
| `value` | `string \| null` | Required. The name of the picked icon. |
| `onValueChange` | `(name: string) => void` | Required. |
| `onClear` | `() => void` | |
| `label` | `string` | |
| `disabled` | `boolean` | |
| `className` | `string` | |
| `ref` | `Ref<HTMLDivElement>` | |

`IconPickerProps` and `IconPickerGroup` are exported types.
