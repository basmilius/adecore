# TabStrip

The tabs of the open documents. The strip scrolls sideways, keeps the active tab in view, and draws close buttons, pins, unsaved marks and attention marks. For navigation sections of a view, use [`Tabs`](/ui/layout/tabs).

<Demo src="layout/tab-strip" />

`TabStripProps` requires `items`, `value` and `onValueChange`. A `TabStripItem` has an `id` and a `label`, and optionally `hint`, `icon`, `detail`, `attention`, `unsaved`, `pinned` and `closable`. `tabId` and `panelId` tie a tab to a panel the app draws.

When the active tab changes, the strip scrolls it fully into view. Once a person scrolls the strip, it keeps their position until the active tab changes again.

`focused` (default true) draws the active underline in the accent. The active tab always shows its close button, the others on hover or focus. `closable: false` hides it. The app acts in `onClose(id)`, `onDoubleClick(id, event)` and `onContextMenu(id, event)`.

`pressToClose` closes a tab on a middle click or a Shift-click. Pinned tabs and tabs without a close button stay open.

`onDragStart(id, event)` makes the tabs draggable; clear drag state in `onDragEnd(event)`. `onTabDragOver(index, event)` and `onTabDrop(index, event)` report the gap nearest the pointer, counted in the order before the drag, dragged tab included. Call `preventDefault()` in dragover to accept a drop. `insertAt` draws a 2 pixel line at a gap. Drag MIME types and payloads are the app's. A [`SplitView`](./split-view) handles moving tabs between panes itself.

For a tab whose details come from hooks, return a `DocumentTab` from `renderTab(item)`. `DocumentTabProps` takes `item`, the props of a `<span>`, `className`, `ref` and `render`. Its own `onClose()`, `onDoubleClick(id, event)`, `onDragStart(id, event)` and `onDragEnd(event)` replace the strip's. `closeShortcut` adds a key to the close button's tooltip. `unsaved` is a boolean, or the text a screen reader hears instead. For a context menu, render the menu trigger as the tab with `render={<DocumentTab item={item} />}`.

The strip also takes the props of a `<div>`, `className`, `ref` and `render`. Give it a height.
