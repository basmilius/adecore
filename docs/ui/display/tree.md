# Tree rows

`Tree` shares `FileTree` row appearance for nodes whose identities are not file paths. The host owns selection, loading, expansion and keyboard navigation. `DatabaseExplorer` uses these parts for connections, schemas, tables and columns.

<Demo src="display/tree" />

## Guides

- [Getting started](/ui/display/tree/getting-started) builds a small controlled tree with roving focus and keyboard navigation.
- [Integrating a custom model](/ui/display/tree/model-integration) covers lazy nodes, persistence, menus, controls and database usage.
- [Part reference](/ui/display/tree/reference) lists props, defaults, event isolation and accessibility responsibilities.

`Tree.Root` renders a named `role="tree"` container. `Tree.Row` renders a `role="treeitem"` with level, selection and joined-selection styling. Its indentation guides, 25px height, hover and accent focus outline match the file tree. Supply the tab stop, expansion state, sibling counts and event handlers your model requires.

`Tree.Chevron` toggles expansion without selecting its row. `Tree.ChevronSlot` aligns leaves. `Tree.Label` truncates names at the end, and `Tree.Decoration` groups trailing content. `Tree.Control` isolates another interactive control; `Tree.Checkbox` supplies real mixed and disabled checkbox states.

All element parts accept `className`, `ref` and Base UI's `render` prop. Keep rows containing interactive controls as `div` elements. Changing their tag to a button would nest other buttons inside it.

Set up the [theme and provider](/ui/guide/getting-started) before rendering. Tree parts do not create a data model, implement filesystem commands or provide a complete accessibility policy automatically.
