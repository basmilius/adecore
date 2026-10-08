# SplitView

`SplitView` lays out a recursive tree of panels. Horizontal and vertical splits can be nested at any depth. Panels can host document tabs or fixed tools without tabs.

<Demo src="layout/split-view" />

The example has no document strip: each leaf contains one view, and resize separators still work with the pointer and keyboard. Applications can send `SplitCommand` actions through `updateSplitLayout` to change the layout from their own menus or shortcuts.

For the controlled state, drag interactions, sizing, view lifetime and complete API, see [Workspace](./workspace). For independent document tabs, see [TabStrip](./tab-strip).
