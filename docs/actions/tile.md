# Tile

One thing to start with, drawn as a card that is a button. A start screen and the empty places of an app use it, so a place to begin looks the same wherever it is offered.

```tsx
import { Tile } from '@basmilius/react-ui';
```

<Demo src="actions/tile" />

Give one tile on a screen `primary`, and its border and its icon take the accent. `sm` is for a narrow column like a sidebar. The description is one short line, such as where the action lands or why it waits, and it truncates rather than wraps.

## Props

`Tile` takes every prop of a `<button>` except `title`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `icon` | `ReactNode` | | Required. A 16 pixel `Icon`. |
| `title` | `string` | | Required. |
| `description` | `ReactNode` | | One line under the title. |
| `shortcut` | `Shortcut` | | Printed at the end of the tile. |
| `primary` | `boolean` | `false` | |
| `size` | `'md' \| 'sm'` | `'md'` | |

`TileProps` is an exported type.
