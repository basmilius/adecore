# ContextMenu

A menu that opens at the pointer on a right-click. Only the root and trigger differ from a [menu](/ui/overlays/menu).

```tsx
import { ContextMenu } from '@adecore/ui';
```

<Demo src="overlays/context-menu" />

## Parts

`ContextMenu.Root` holds the open state and `ContextMenu.Trigger` is the right-click area. The other parts are the menu's: `ContextMenu.Popup`, `ContextMenu.Item`, `ContextMenu.CheckboxItem`, `ContextMenu.RadioGroup`, `ContextMenu.RadioItem`, `ContextMenu.Group`, `ContextMenu.GroupLabel`, `ContextMenu.Label`, `ContextMenu.Separator`, `ContextMenu.Hint`, `ContextMenu.Check`, `ContextMenu.SubmenuRoot`, `ContextMenu.SubmenuTrigger`, `ContextMenu.Row`, `ContextMenu.RowAction` and `ContextMenu.RowSubmenuTrigger`. See [Menu](/ui/overlays/menu#parts) for what each does.

`ContextMenu.Popup` opens at the pointer and needs no placement.

For copying from a block of text, use [`TextMenu`](/ui/overlays/text-menu).
