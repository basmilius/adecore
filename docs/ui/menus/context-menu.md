# ContextMenu

A menu that opens at the pointer on a right-click. Only the root and trigger differ from a [menu](/ui/menus/menu).

```tsx
import { ContextMenu } from '@adecore/ui';
```

<Demo src="overlays/context-menu" />

## Parts

`ContextMenu.Root` holds the open state and `ContextMenu.Trigger` is the right-click area. `ContextMenu.Popup` opens at the pointer and needs no placement.

The rows are those of a [menu](/ui/menus/menu#parts). `ContextMenu.Item` acts, `ContextMenu.CheckboxItem` toggles, and `ContextMenu.RadioItem` picks one value of a `ContextMenu.RadioGroup`. `ContextMenu.Group` and `ContextMenu.GroupLabel` name a group, `ContextMenu.Label` heads rows that are no group, and `ContextMenu.Separator` divides them. `ContextMenu.Hint` notes what a row does and `ContextMenu.Check` shows a state in a plain row. `ContextMenu.SubmenuRoot` and `ContextMenu.SubmenuTrigger` open a submenu. `ContextMenu.Row` puts buttons at the end of a row, where `ContextMenu.RowAction` acts and `ContextMenu.RowSubmenuTrigger` opens a submenu.

For copying from a block of text, use [`TextMenu`](/ui/menus/text-menu).
