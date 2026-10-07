# Kbd, KeyCap and Keys

A shortcut as the platform prints it: `⌘K` on macOS, `Ctrl+K` elsewhere. `Kbd` prints it as one chip, `Keys` as one cap per key, and `KeyCap` is a single cap.

```tsx
import { Kbd, KeyCap, Keys } from '@adecore/ui';
```

<Demo src="display/kbd" />

## Kbd

`Kbd` takes a [`Shortcut`](/ui/utilities/shortcuts) and prints it for the platform in front of the page. Without one it prints its children as they are, for a key that is no shortcut, such as `Esc` or `↑`.

In a menu row (`variant="menu"`, the default) the `.menu-item kbd` rule dresses it as the quiet hint at the end of the row. Anywhere else, such as in a sentence, a tooltip or a palette's footer, use `variant="inline"` for a chip on the surface it sits on.

## Keys and KeyCap

A settings page that lists shortcuts prints them key by key, so a pointer gesture can stand beside them. `then="drag"` adds one more cap after the keys. `KeyCap` is one cap with a heavier bottom edge.

`size="sm"` draws caps of 20 pixels, which fit inside a small field: the key that focuses a search field, at its end.

## Props

| Component | Prop | Type | Default | |
| --- | --- | --- | --- | --- |
| `Kbd` | `shortcut` | `Shortcut` | | Printed for this platform. |
| | `children` | `ReactNode` | | Printed as it is when there is no `shortcut`. |
| | `variant` | `'menu' \| 'inline'` | `'menu'` | |
| `Keys` | `shortcut` | `Shortcut` | | Required. |
| | `then` | `string` | | The gesture the keys go with, as one more cap. |
| | `size` | `'md' \| 'sm'` | `'md'` | |
| `KeyCap` | `children` | `ReactNode` | | Required. |
| | `size` | `'md' \| 'sm'` | `'md'` | |

All three take `className` and `ref`. `KbdProps`, `KeysProps` and `KeyCapProps` are exported types.
