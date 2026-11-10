---
aside: false
---

# Workspace

`Workspace` lays out a toolbar, side regions and the content between them. `SplitView` fills the content with nested, resizable panels that hold document tabs. Each works on its own. The navigation [`Tabs`](/ui/layout/tabs) are separate from both.

<Demo src="layout/workspace" fill />

Type in a document, then move its tab. The text goes with it.

## Layout and appearance

`WorkspaceProps` takes `layout`, `toolbar`, `sidebar`, `sidePanel`, `rail`, `sidebarWidth`, `sidePanelWidth` and `children`, plus `className`, `ref`, `render` and the props of a `<div>`. A region left out, `false` or `null` is closed. The sidebar is 248 pixels wide and the side panel 320. For a resizable region, bring your own handle. Width `'auto'` is for contents that size and animate themselves, such as `SlidingColumn`s. Those stay mounted when closed, so pass `sidebarOpen` or `sidePanelOpen` for the corners and flush edges to follow.

`WorkspaceLayout` is `'standard' | 'roomy'`. Standard, the default, draws a 1 pixel `--separator` line between regions. Roomy puts 8 pixel gaps between them and rounds their corners by 8, except a corner on a flush outer edge.

The sidebar, the toolbar and the content lie on one sheet with a 12 pixel rounded right edge, a hairline and `--sheet-shadow`. In the roomy layout its bottom corner is square and it has no shadow, since the gaps set it apart. The side panel and the `rail` sit behind it in a slightly darker well, and `--surface` inside the panel resolves to that well.

Give the container a height; both components fill it. A page can hold several.

## The top row, the rail and pane bars

An app shell puts three parts around the content: a top row with the project, a rail with its tools, and a bar over each pane.

`WorkspaceTopRow` is the 47 pixel band to pass as `toolbar`. `WorkspaceTopRowProps` takes `leading`, `children` and `slotless`, plus the props of a `<header>`. `leading` comes first: room for a window's own controls, or a button that brings a closed sidebar back. `children` is the project, a `ProjectSwitcher` or a strip of project tabs. After it the row keeps a slot, where the bar of a lone pane goes. `slotless` leaves the slot out, for project tabs that take the whole row. The window drags by every part of the row that is not a button, an input, a link, a tab or a pane's title.

`rail` is a column at the right edge, after the side panel. `WorkspaceRail` draws it 48 pixels wide, labeled "Tools" unless you pass an `aria-label`; `WorkspaceRailProps` are the props of a `<nav>`. `WorkspaceRailSeparator` goes between groups and `WorkspaceRailSpacer` pushes the last group down. With 32 pixel buttons and one button before the first separator, that separator lands on the bottom line of the top row. Give its buttons `tooltipSide="left"`. A line stands between the rail and an open side panel, and fades with it.

`PaneBar` is the bar over a pane. `PaneBarProps` take the props of a `<header>`, plus:

| Prop | Type | |
| --- | --- | --- |
| `title` | `ReactNode` | Required. A glyph and a name, or a `TabStrip` with `tabs`. |
| `tabs` | `boolean` | The title is a strip of tabs, which takes the bar's room. `accessory`, `actions` and `trailing` stand at the end of the strip while they hold at most three controls (two and an overflow menu), and get a bar of their own under it once they hold more. |
| `actions` | `ReactNode` | The pane's own controls. Once the title has shrunk to its glyph and they still do not fit, they fold into a "More actions" popover. |
| `separated` | `boolean` | A separator between the title and the actions. |
| `accessory`, `trailing` | `ReactNode` | Before and after the actions. |
| `focused` | `boolean` | The pane has the focus; an unfocused bar is drawn on `--surface-idle`. |
| `onClose`, `closeLabel`, `closeShortcut` | | The close button, drawn only with `onClose`. |
| `menu` | `ReactNode` | The items of the bar's context menu. |
| `onDragStart`, `onDragEnd` | | Makes the bar a handle that drags the pane. A press on a control inside it never starts a drag. |
| `container` | `HTMLElement \| null` | An element to draw the bar in instead of over the pane. |

`useTopRowSlot()` returns the top row's slot inside a `Workspace`, or null. Pass it as `container` when a pane stands alone, and its bar joins the project in the top row, after a separator. The bar stays the pane's in the React tree, so its drag events still reach the pane's handlers. In a split, leave `container` null and every pane keeps its own bar.

```tsx
import { useState } from 'react';
import { Folder, GitBranch, Search, Settings } from 'lucide-react';
import { IconButton, PaneBar, ProjectSwitcher, Workspace, WorkspaceRail, WorkspaceRailSeparator, WorkspaceRailSpacer, WorkspaceTopRow, useTopRowSlot } from '@adecore/ui';

function ViewBar({ name, alone, onClose }: { name: string; alone: boolean; onClose(): void }) {
    const slot = useTopRowSlot();

    return <PaneBar title={name} focused onClose={onClose} closeLabel="Close view" container={alone ? slot : null} />;
}

function Shell() {
    const [panel, setPanel] = useState<'files' | 'git' | null>(null);
    const toggle = (kind: 'files' | 'git') => setPanel(panel === kind ? null : kind);

    return (
        <Workspace
            toolbar={
                <WorkspaceTopRow>
                    <ProjectSwitcher current={project} groups={groups} onSelect={open} />
                </WorkspaceTopRow>
            }
            rail={
                <WorkspaceRail>
                    <IconButton icon={Search} label="Search" tooltipSide="left" />
                    <WorkspaceRailSeparator />
                    <IconButton icon={Folder} label="Files" tooltipSide="left" active={panel === 'files'} onClick={() => toggle('files')} />
                    <IconButton icon={GitBranch} label="Git" tooltipSide="left" active={panel === 'git'} onClick={() => toggle('git')} />
                    <WorkspaceRailSpacer />
                    <IconButton icon={Settings} label="Settings" tooltipSide="left" />
                </WorkspaceRail>
            }
            sidePanel={panel && <SidePanel kind={panel} />}
        >
            <ViewBar name="Admin" alone onClose={close} />
            <ViewBody />
        </Workspace>
    );
}
```

A panel that has a toggle in the rail closes from there and needs no close button in its header. Give one to a panel that opens from a menu or a command instead.

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

A `SplitLayout` holds `root`, `focused` and `maximized`. A `SplitNode` is a `SplitPane` or a `SplitBranch`:

- A pane has `type: 'pane'`, a stable `id`, its `views` in order and the id of its `active` view, or `null`.
- A branch has `type: 'split'`, a stable `id`, an `axis`, its `children` and their `sizes`, positive shares that add up to one. `SplitAxis` is `'horizontal' | 'vertical'`: horizontal puts the children side by side, vertical stacks them.
- `focused` and `maximized` are pane ids. `maximized` is `null` while every pane shows.

Node ids are unique within a layout, and a view id sits in one pane at most. To open a document twice, give the two views different ids. The layout stores ids, never documents.

`createSplitLayout(views?, paneId?)` makes a layout of one pane. `splitPanes(root)` lists the panes in layout order. Storing, validating and migrating a layout is up to the app.

## Commands

`updateSplitLayout(value, command)` returns the next layout without changing its input. `SplitCommand` is a discriminated union. A command whose target is gone returns the layout unchanged.

| Command | Fields and what it does |
| --- | --- |
| `activate` | `paneId`, `viewId`: shows the view and focuses its pane. |
| `focus` | `paneId`: focuses the pane and keeps its active view. |
| `maximize` | `paneId`, or `null` to restore. Every view stays mounted. |
| `insert` | `paneId`, `viewId`, optional `index`: adds a new view, or moves one that is open elsewhere. |
| `replace` | `viewId`, `replacement`: puts a view that is not open yet in the place of an open one, which leaves the layout. |
| `split` | `targetId`, `side`, `newPane`, `splitId`: adds a pane beside the target, a pane or a whole branch, at any depth. |
| `move` | `sourceId`, `targetId`, optional `viewId`, `side`, `index`, `newPaneId`, `splitId`: moves one tab, or the whole pane without `viewId`. A drop on an edge needs a new `splitId`, and a single tab dropped on an edge also a new `newPaneId`. With a `side` the target may be a branch, so a pane lands beside a whole stack of panes. |
| `swap` | `sourceId`, `targetId`, optional `viewId`: trades two whole panes, or one tab with the target's active tab. A tab that is alone in its pane takes the pane with it. |
| `close` | `viewId`: closes the view, and its pane when that is left empty, unless it is the last pane. |
| `closePane` | `paneId`: closes the whole group. The last pane is left empty instead. A focused pane that closes hands the focus to the sibling after it, else the one before it. |
| `resize` | `splitId`, `sizes`: sets new positive shares. |
| `equalize` | `splitId`, optional `index`: balances the two children beside a divider, or every child without `index`. |
| `equalizeAxis` | `axis`, optional `length` and `gap`: spreads the tracks of the whole layout evenly in one direction, nested splits included. |

`SplitSide` is `'left' | 'right' | 'top' | 'bottom'`. A `move` without a side adds the tab to the target's group. Only `close`, `closePane` and `replace` take a view out of the layout. The `index` of an insertion is a gap in the tab order before the move. A whole pane moved to an edge keeps its id. Redundant branches collapse, and two splits along the same axis share one branch. The `splitId` you pass is used only when a new branch is needed.

`equalizeAxis` counts tracks across nested splits: a panel above three columns spans three tracks. `SplitView` passes `length` and `gap` in pixels; without them the command spreads shares. Pane minimums still hold.

`onValueChange(next, command)` hands over the proposed layout and the command behind it. The app may refuse it or apply its own limits.

## Rendering and the life of a view

`SplitViewProps` requires `value`, `onValueChange` and `renderView`. `renderView(id, info)` receives a `SplitViewInfo` with the `paneId` and whether the view is `active`. `getTab(id)` returns what a tab shows. `renderPaneHeader(pane)` replaces the header above a pane, and `showTabs={false}` hides it. `headerHeight` defaults to 36 pixels.

Inactive views and panes behind a maximized one stay mounted, hidden and inert. Only closing a view unmounts it. A view keeps its state through a move as long as it renders the same component type and is not keyed by pane id.

`onViewBoundsChange(bounds)` receives a `SplitViewBounds` per view: `viewId`, `paneId`, `active`, a `SplitRect` (`x`, `y`, `width`, `height`) in the viewport and the CSS `borderRadius`. A native view laid over the page can follow those bounds, hidden while `active` is false and clipped as reported. On unmount the list is empty.

`minimumSize` is a `SplitMinimum` (`width`, `height`) or a function of the pane, 120 by 80 pixels by default, header included. In a window too small for all minimums, panes shrink in proportion and the stored shares stay. `minimumResizeShare` (default 0) keeps a dragged divider from squeezing a pane below that share of its span.

On its own, a `SplitView` takes `layout` and `flushEdges`. `SplitEdges` lists which outer edges touch the window (`top`, `right`, `bottom`, `left`, all by default). Inside a `Workspace` it takes both from the workspace.

## Dragging, closing and the keyboard

Dragging reorders tabs, moves a tab or a whole group (by its grip) to another pane, and splits a pane when dropped near its edge. A drop in the middle of a pane swaps it with the source. An outline previews the result.

`canDrop(drag, target)` can refuse a move. A `SplitDrag` names the source pane and, for one tab, the view. A `SplitDropTarget` names the target pane, the side and the tab gap. `side: 'center'` is the middle of a pane; no side is the tab strip. `onViewDragStart(id, event)` can write a payload of the app's own. Another workspace on the page does not accept these drags.

For drops from outside, pass both `canDropExternal(event, target)` and `onExternalDrop(target, event)`. The first accepts payload types during the drag, the second reads the data and changes the layout. A child that calls `preventDefault()` on a drop keeps it.

A tab closes at once unless you pass `onClose(id)`. Then it stays until you change the layout, for example after a confirmation. Use `onTabDoubleClick` and `onTabContextMenu` to pin a tab or open its menu.

| Key | Where | Action |
| --- | --- | --- |
| Arrow keys, Home, End | Tab | Switch tabs |
| Delete | Tab | Close the tab |
| Alt + arrow key | Pane or header | Focus the neighboring pane (not inside an editor) |
| Arrow keys, Shift for larger steps | Divider | Resize |
| Home, End | Divider | Go to its limits |
| Enter, double-click | Divider | Balance the two panes beside it |
| Alt with a resize | Divider | Mirror it on the matching divider |
| Alt + Enter, Alt + double-click | Divider | Spread that direction evenly over the whole layout |

A dragged divider snaps to the middle within 8 pixels.

Floating windows, pop-outs and dragging between windows are not supported.
