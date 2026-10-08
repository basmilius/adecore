---
aside: false
---

# Workspace

`Workspace` arranges a toolbar, optional side regions and content. `SplitView` supplies nested, resizable panels with document tabs. Use either on its own, or compose them as below. Existing navigation `Tabs` are independent.

<Demo src="layout/workspace" fill />

Use the controls to compare standard and roomy spacing in light or dark appearance, open the side regions and add nested splits. Edit a document before moving its tab to see its contents stay with it. The appearance control applies only to this demo.

## Layout and appearance

`WorkspaceProps` accepts `layout`, `toolbar`, `sidebar`, `sidePanel`, `sidebarWidth`, `sidePanelWidth` and `children`, along with `className`, `ref`, `render` and the native div props. Omit a region, or pass `false` or `null`, to close it. Side regions are fixed-width surfaces; applications can supply their own resize controls. The default widths are 248 and 320 pixels. Set a region's width to `'auto'` when its contents already manage sizing, separators and animation, such as one or more `SlidingColumn` components. Auto-sized regions render their contents directly into the flex layout. Use `sidebarOpen` or `sidePanelOpen` to tell the workspace when those contents are closed; they stay mounted while toolbar corners and flush edges follow the open state.

`WorkspaceLayout` is `'standard' | 'roomy'`. Standard is the default: adjacent surfaces have 1px separators, without extra spacing or rounded corners. Roomy uses 8px gaps and 8px corners. A corner touching any flush outer edge stays square. The toolbar gets space below it and rounds its bottom corners only beside open side regions. Both layouts use the opaque `--separator` token, and borders inside the workspace follow it. The mode does not select light or dark appearance.

Give the container a height. Both components fill their container and can appear several times on one page. Their drag state and IDs are isolated.

## Controlled state

```tsx
import { useState } from 'react';
import { SplitView, Workspace, createSplitLayout } from '@adecore/ui';

function EditorWorkspace() {
    const [value, setValue] = useState(() => createSplitLayout(['notes']));
    return (
        <Workspace layout="roomy" toolbar={<EditorToolbar />}>
            <SplitView
                value={value}
                onValueChange={setValue}
                getTab={(id) => ({ label: id })}
                renderView={(id) => <Editor documentId={id} />}
            />
        </Workspace>
    );
}
```

`SplitLayout` contains `root`, `focused` and `maximized`. A `SplitNode` is either a `SplitPane` or a `SplitBranch`:

- A pane has `type: 'pane'`, a stable `id`, ordered `views` and an `active` view ID or `null`.
- A branch has `type: 'split'`, a stable `id`, an `axis`, `children` and positive `sizes` that sum to one. `SplitAxis` is `'horizontal' | 'vertical'`. Horizontal places children beside each other; vertical stacks them.
- `focused` and `maximized` contain pane IDs. `maximized` is `null` when all panes are visible.

Every node ID is unique within a layout. Every view ID occurs in at most one pane. An application that opens the same document twice gives its two view instances different IDs. Views can contain any content; the layout stores no document payloads.

`createSplitLayout(views?, paneId?)` creates one pane. `normalizeSplitLayout(unknown)` repairs persisted data, deduplicates IDs, removes invalid branches, repairs selection, normalizes sizes and merges consecutive branches on the same axis. Call it when loading data, not on every render. The application owns serialization, versioning, storage and migration from older formats. `splitPanes(root)` lists panes in layout order.

## Commands

`updateSplitLayout(value, command)` returns the next state without changing its input. `SplitCommand` is a discriminated union. Invalid targets and stale commands return the original state.

| Command | Fields and behavior |
| --- | --- |
| `activate` | `paneId`, `viewId`: activates the view and focuses the pane. |
| `focus` | `paneId`: changes focused pane without changing its active view. |
| `maximize` | `paneId` or `null`: maximizes or restores, keeping all views mounted. |
| `insert` | `paneId`, `viewId`, optional `index`: inserts a new view or moves an existing one. |
| `split` | `paneId`, `side`, `newPane`, `splitId`: adds a new pane next to the target at any depth. |
| `move` | `sourceId`, `targetId`, optional `viewId`, `side`, `index`, `newPaneId`, `splitId`: moves one tab or, without `viewId`, the whole pane. An edge drop needs a fresh `splitId`; moving one tab to an edge also needs a fresh `newPaneId`. |
| `swap` | `sourceId`, `targetId`, optional `viewId`: exchanges whole panes, or one tab with the target active tab. A lone source tab moves its whole pane. |
| `close` | `viewId`: closes a view and removes its pane if empty, unless it is the last pane. |
| `closePane` | `paneId`: closes the whole group. The last pane becomes empty. |
| `resize` | `splitId`, `sizes`: updates positive shares. |
| `equalize` | `splitId`, optional `index`: balances the neighboring children at a divider, or all children when the index is omitted. |
| `equalizeAxis` | `axis`, optional `length` and `gap`: distributes tracks across the entire layout in one direction, including nested splits. |

`SplitSide` is `'left' | 'right' | 'top' | 'bottom'`. A `move` without a side groups tabs. Use `swap` for a center drop: whole panes exchange positions while split proportions stay put; a tab taken from a group exchanges places with the active target tab. No view is discarded. The optional insertion index denotes a gap in the **original** tab order; the reducer accounts for the source being lifted out. Moving a whole pane to an edge preserves its pane ID. Redundant branches collapse after moves and closes. Consecutive splits on the same axis share one branch, so their dividers resize neighboring panes. Splitting in the other direction creates a nested branch. Merging a branch preserves pane IDs and relative shares; its redundant branch ID is retired. The supplied `splitId` is used only when a new branch is needed.

`equalizeAxis` counts the tracks across nested splits. A panel above three columns spans all three, while a panel beside them occupies one track. The other direction keeps its existing sizes. `SplitView` supplies the current axis length and separator gap in pixels so spanning panels include their internal gaps. Without these measurements, the command uses proportional shares (`length: 1`, `gap: 0`). Minimum pane sizes still apply.

`onValueChange(next, command)` reports both the proposed state and its cause. The application can reject a change or apply its own layout limits. The core has no fixed limit on the number of rows, columns or nesting levels.

## Rendering and view lifetime

`SplitViewProps` requires `value`, `onValueChange` and `renderView`. `renderView(id, info)` receives `SplitViewInfo` with `paneId` and `active`. `getTab(id)` supplies document metadata. `renderPaneHeader(pane)` replaces the default tab strip and controls; `showTabs={false}` removes the default header. `headerHeight` defaults to 36 pixels.

All view hosts remain siblings in a stable order under one parent. Moves update their position, without reparenting them. Inactive tabs and panels hidden by maximization remain mounted, hidden and inert. Closing a view removes it. Keep the rendered component type stable and do not key it by pane ID if its local state must survive moving.

`onViewBoundsChange(bounds)` receives `SplitViewBounds` entries with a `viewId`, `paneId`, `active`, viewport `rect` and CSS `borderRadius`. Native surfaces can stay in their own stable layer and follow these bounds. `SplitRect` contains `x`, `y`, `width` and `height`. Hide a native surface when `active` is false and apply the reported clipping. Unmounting the SplitView reports an empty bounds list. The host remains responsible for creating and disposing native surfaces.

`minimumSize` is a `SplitMinimum` (`width`, `height`) or a function of the pane. Defaults are 120 by 80 pixels, including the header. Nested minimums contribute to their ancestors. If a window is smaller than all minimums, panes shrink proportionally rather than overflow. Stored shares remain unchanged until a user resizes. `minimumResizeShare` optionally limits a dragged pane to a fraction of the neighbors being resized; it defaults to zero. For example, `0.15` keeps at least 15% of that span in each pane, subject to available space and pixel minimums.

A standalone SplitView can set `layout` and `flushEdges`. `SplitEdges` marks which outer edges touch the window: `top`, `right`, `bottom`, `left`. All are flush by default. When composed inside Workspace, the appropriate edges and layout are inherited.

## Dragging, closing and keyboard access

The built-in drag interactions reorder tabs, move tabs between panes, move whole groups using the grip, and split near a pane edge. Dropping on the tab strip groups tabs; dropping in the middle of the content replaces what is shown there by swapping it with the source. The displaced pane or active view moves back to the source position, so it remains open. An outline previews the resulting tab and pane.

`canDrop(drag, target)` can reject internal moves. `SplitDrag` identifies the source pane and optional view; `SplitDropTarget` identifies the target pane, optional side and original tab gap. `side: 'center'` denotes a replacement drop in the body; an omitted side denotes the tab strip. External drops can apply an application-specific replacement policy. `onViewDragStart(id, event)` can write application-specific drag payloads. Other workspace instances do not claim this internal drag automatically.

External payloads belong to the application. Supply both `canDropExternal(event, target)` and `onExternalDrop(target, event)`. The former recognizes supported payload types during dragover; the latter reads their data and updates the controlled state. A child that calls `preventDefault()` on its drop owns that drop, so a text editor or composer can consume files itself.

Tabs close immediately by default. Supply `onClose(id)` to request confirmation, save changes or close an application resource. With this callback, the component does not remove the tab; update the state after approval. `onTabDoubleClick` and `onTabContextMenu` likewise let the application implement pinning and menus.

Tab arrows, Home and End change the active tab; Delete requests a close. Alt + arrow keys focus an adjacent pane from a panel header or the panel itself; keys inside an editor remain with that editor. Focusable resize separators support arrow keys, Shift for larger steps, Home/End for limits and Enter for equal distribution. Dragging within 8px of an even split snaps the two neighboring panes to equal sizes. Double-click balances those neighbors immediately. Alt mirrors the divider when a matching divider exists; Alt + Enter or Alt + double-click distributes the chosen direction across the entire layout, including ancestors and nested splits. For example, triggering it between two small panels can also resize larger panels beside their ancestors. Heights stay unchanged when distributing widths, and widths stay unchanged when distributing heights. Resize feedback is the same 2px accent line in standard and roomy layouts. Pointer cancellation and lost capture end the resize.

Floating windows, pop-outs and cross-window drag coordination are outside this module.
