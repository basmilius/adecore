# ContextMenu

A menu that opens at the pointer on a right-click. Every part inside it is the [menu's](/overlays/menu) own; only the root and the trigger differ.

```tsx
import { ContextMenu } from '@basmilius/react-ui';
```

<Demo src="overlays/context-menu" />

## Parts

`ContextMenu.Root` holds the open state and `ContextMenu.Trigger` is the area a right-click opens the menu over. Every other part is the menu's own under another name: `ContextMenu.Popup`, `ContextMenu.Item`, `ContextMenu.CheckboxItem`, `ContextMenu.RadioGroup`, `ContextMenu.RadioItem`, `ContextMenu.Group`, `ContextMenu.GroupLabel`, `ContextMenu.Label`, `ContextMenu.Separator`, `ContextMenu.Hint`, `ContextMenu.Check`, `ContextMenu.SubmenuRoot` and `ContextMenu.SubmenuTrigger`. See [Menu](/overlays/menu#parts) for what each does.

`ContextMenu.Popup` opens at the pointer, which its positioner already knows, so it needs no placement. A submenu inside it sits beside its row like any other.

Anywhere text can be selected, a right-click should offer to copy it. [`TextMenu`](/overlays/text-menu) is a context menu that does that for a block of text.
