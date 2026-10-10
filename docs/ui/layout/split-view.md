# SplitView

Panels in a tree: horizontal and vertical splits nested to any depth. A panel holds document tabs, or one fixed tool without tabs.

<Demo src="layout/split-view" />

The demo has no tab strip: each panel holds one view, and the dividers still work with the pointer and the keyboard. An app changes the layout from its own menus or shortcuts by passing a `SplitCommand` to `updateSplitLayout`.

[Workspace](./workspace) covers the controlled state, dragging, sizes, the life of a view and every prop. Document tabs on their own are a [TabStrip](./tab-strip).
