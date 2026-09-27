# TextMenu

A block of text with the context menu that belongs to it: Copy for what is selected inside it, and Select all for the whole of it. Anywhere text can be selected, a right-click should offer to copy it, and an app that draws every menu itself offers nothing without one of these.

```tsx
import { TextMenu } from '@basmilius/react-ui';
```

<Demo src="overlays/text-menu" />

The selection is read when the menu opens, and only a selection inside the block counts. Cmd+A (Ctrl+A elsewhere) selects the block's text while the block has the focus, instead of the whole page. `items` adds rows of your own under a separator; they are `ContextMenu.Item`s.

## Props

`TextMenu` renders a `<div>` and takes its props, plus `items?: ReactNode`. `TextMenuProps` is an exported type.
