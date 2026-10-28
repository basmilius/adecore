# Select

A Base UI select styled as a menu. Arrows, Home and End, typeahead, Enter and Escape work out of the box.

```tsx
import { Select } from '@adecore/ui';
```

<Demo src="inputs/select" />

`outlined`, the default, is a bordered field at most 224 pixels wide. `ghost` is a quiet toolbar trigger. An item can carry an icon, a second-line description and `disabled`. Without a value the trigger shows `placeholder`, or "Select" (`action.select`).

## Groups

Pass `items` a list of groups to get a label above each group's rows.

<Demo src="inputs/select-groups" />

## Search

`searchable` adds a search field above the options: always for `true`, or from that many options on for a number. Typing keeps options whose label contains the text, ignoring case. With one left, Enter picks it. Groups without matches are hidden.

<Demo src="inputs/select-search" />

`searchPlaceholder` sets the field's placeholder and accessible name, "Search" (`select.search`) by default. An empty result shows `select.noMatch`.

## Props

`Select` is generic over the value, a string type.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `T \| null` | | Required. |
| `onValueChange` | `(value: T) => void` | | Required. |
| `items` | `SelectItem<T>[] \| SelectGroup<T>[]` | | Required. |
| `label` | `string` | | Required. The trigger's accessible name. |
| `placeholder` | `string` | "Select" | |
| `size` | `'sm' \| 'md'` | `'md'` | |
| `variant` | `'outlined' \| 'ghost'` | `'outlined'` | |
| `disabled` | `boolean` | | |
| `align` | `'start' \| 'end'` | `'start'` | Where the popup lines up with the trigger. |
| `truncateValue` | `boolean` | `true` | Truncates a long value. |
| `searchable` | `boolean \| number` | | |
| `searchPlaceholder` | `string` | "Search" | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLButtonElement>` | | The trigger. |

A `SelectItem<T>` is `{ value, label, description?, icon?, disabled? }`. A `SelectGroup<T>` is `{ label, items }`. `SelectProps`, `SelectItem` and `SelectGroup` are exported types.
