# TextMenu

A block of text with a context menu: Copy for the selection inside it, and Select all. Anywhere text can be selected, a right-click should offer to copy it.

```tsx
import { TextMenu } from '@adecore/ui';
```

<Demo src="overlays/text-menu" />

Without a selection inside the block, Copy is disabled. While the block has focus, Cmd+A (Ctrl+A elsewhere) selects only its text. `items` adds `ContextMenu.Item`s of your own under a separator.

## Props

`TextMenu` renders a `<div>` and takes its props, plus `items?: ReactNode`. `TextMenuProps` is an exported type.
