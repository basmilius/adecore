# TabStrip

`TabStrip` displays open documents. It scrolls horizontally, keeps the active tab visible and supports close buttons, pin marks, unsaved changes and application-defined attention indicators. Navigation `Tabs` continue to serve navigation sections.

<Demo src="layout/tab-strip" />

`TabStripProps` requires `items`, `value` and `onValueChange`. Each `TabStripItem` has an `id` and `label`, with optional `hint`, `icon`, `detail`, `attention`, `unsaved`, `pinned` and `closable`. `tabId` and `panelId` connect the tab to a panel the application renders. The strip does not render panels or own their state.

`focused` defaults to true and makes the active underline use the accent color. The active tab's close control remains visible; other close controls appear on hover or focus. Set `closable: false` to omit a close control. Supply `onClose(id)`, `onDoubleClick(id, event)` and `onContextMenu(id, event)` for application actions.

Supply `onDragStart(id, event)` to make tabs draggable and `onDragEnd(event)` to clear application drag state. `onTabDragOver(index, event)` and `onTabDrop(index, event)` report the nearest gap between tab midpoints. The index refers to the original order, including the dragged tab. Accept a drop by calling `preventDefault()` in dragover. `insertAt` draws a 2px insertion line when the strip is used without SplitView's pane preview.

For tabs whose metadata comes from hooks, supply `renderTab(item)` and render a `DocumentTab` in that slot. `DocumentTabProps` accepts `item`, native span props, `className`, `ref` and `render`. It inherits selection, keyboard navigation and callbacks from its strip. Its optional `onClose()`, `onDoubleClick(id, event)`, `onDragStart(id, event)` and `onDragEnd(event)` override the strip's callbacks. `closeShortcut` adds a keyboard hint to the close control. `unsaved` can be a boolean or a specific accessible description, such as unsubmitted table changes. Wrap the tab in a context menu trigger using `render={<DocumentTab item={item} />}` to keep the application's menu.

The application supplies its own MIME types and payloads. For a complete layout with integrated tab moves and drop previews, use [SplitView](./split-view).

The component also accepts native div props, `className`, `ref` and Base UI's `render` prop. Give it a height; the strip fills that height and uses its available width.
