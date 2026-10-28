# Kbd, KeyCap and Keys

A shortcut as the platform prints it: `⌘K` on macOS, `Ctrl+K` elsewhere. `Kbd` prints it as one chip, `Keys` as one cap per key, and `KeyCap` is a single cap.

```tsx
import { Kbd, KeyCap, Keys } from '@adecore/ui';
```

<Demo src="display/kbd" />

## Kbd

`Kbd` takes a [`Shortcut`](/ui/utilities/shortcuts) and prints it for the platform. Without one it prints its children, for a key such as `Esc` or `↑`.

`variant="menu"` (the default) is the quiet hint at the end of a menu row. Elsewhere, such as in a sentence, a tooltip or a footer, use `variant="inline"` for a chip.

## Keys and KeyCap

`Keys` prints a shortcut key by key, as a settings page lists them. `then="drag"` adds a cap for a pointer gesture after the keys. `KeyCap` is one cap.

`size="sm"` caps fit inside a small field, such as the hint at the end of a search field.

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
