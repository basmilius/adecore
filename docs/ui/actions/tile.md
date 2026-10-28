# Tile

A card that is a button, for a start screen or an empty state.

```tsx
import { Tile } from '@adecore/ui';
```

<Demo src="actions/tile" />

Make at most one tile per screen `primary`; its border and icon take the accent. `sm` fits a sidebar. The description is one line and truncates.

## Props

`Tile` takes every prop of a `<button>` except `title`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `icon` | `ReactNode` | | Required. A 16 pixel `Icon`, in a 32 pixel box. |
| `title` | `string` | | Required. |
| `description` | `ReactNode` | | One line under the title. |
| `shortcut` | `Shortcut` | | Printed at the end of the tile. |
| `primary` | `boolean` | `false` | |
| `size` | `'md' \| 'sm'` | `'md'` | |

`TileProps` is an exported type.
