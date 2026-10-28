# SplitView

Panels in a tree: horizontal and vertical splits nested to any depth. A panel holds document tabs, or one fixed tool without tabs.

<Demo src="layout/split-view" />

The demo has no tab strip; each panel holds one view. To change the layout from a menu or shortcut, pass a `SplitCommand` to `updateSplitLayout`.

[Workspace](./workspace) covers state, dragging, sizes and every prop. Document tabs on their own are a [TabStrip](./tab-strip).

## A drag layer of the app's own

An app that runs its own drags over cells drawn with `showTabs={false}` can show the same drop outline as `SplitView`.

```tsx
import { DropPreview, rectDropPreview, tabDropPreview, tabGapAt } from '@adecore/ui';
```

<Demo src="layout/drop-preview" />

`DropPreview` draws a `DropPreviewShape` in the coordinates of its nearest positioned ancestor, which it fills. `shape={null}` draws nothing. Between shapes the outline animates. It takes `className` and `ref` (on the `<svg>`). `DropPreviewProps` is an exported type.

`rectDropPreview(rect)` makes a shape from a `SplitRect`, for a split or a swap. `tabDropPreview(drop, origin)` makes one from a `TabDrop`, for a tab in a cell's bar: `gap` is the strip gap, `left` and `tabWidth` place the tab, and `width`, `height` and `barHeight` describe the cell, all relative to `origin`, the cell's top left. `tabGapAt(rects, x)` returns the gap nearest the pointer, from 0 to `rects.length`.

`sameDropPreview(left, right)` says whether two shapes match. Store a new shape only when it differs, so `dragover` renders once per zone.
