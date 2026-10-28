# Call hierarchy

The callers or callees of a symbol, as a tree in a panel between the editor's lines. It is the peek panel with a tree on the left and the code of the active call on the right.

`language.callHierarchy.open(position?, direction?)` prepares the symbol at the caret with `textDocument/prepareCallHierarchy` and opens its callers (`'incoming'`, the default) or callees (`'outgoing'`). Several symbols at one position, such as overloads, give several roots. The chord is `callHierarchy` (`Ctrl+Alt+H` everywhere), and pressing it again switches direction. The context menu lists it where supported.

## Type hierarchy

`language.callHierarchy.open(position, 'supertypes')` or `'subtypes'` walks a type's hierarchy through `textDocument/prepareTypeHierarchy`, `typeHierarchy/supertypes` and `typeHierarchy/subtypes`. The code beside the tree is the type itself. The chord is `typeHierarchy` (`Ctrl+H` everywhere, as in IntelliJ), and pressing it again switches direction. `typesSupported` says whether a server answers these methods.

## What it asks, and when

The tree needs the service's optional `prepareCallHierarchy`, `incomingCalls` and `outgoingCalls` ([`LanguageService`](/lsp/language-service)) and a server with `callHierarchyProvider`; `language.callHierarchy.supported` says so. Otherwise `open` shows a notification.

A node asks for its calls once, when first opened. Calls keep the server's order. A level shows 50 calls, then a row for the next 50. A `StaleResultError` or a text change closes the tree.

## Rows

A row shows the symbol's kind badge, name, detail, file and line, and for a caller with several call sites their count (`×3`). Deprecated symbols are struck through. An opened node shows `Loading…`, `No callers`, `No callees` or the server's error; pressing that row retries.

The code on the right is the active row's first call site (`fromRanges`), or the symbol itself for a root. With several sites, the header steps through them (`stepSite(1)`, `stepSite(-1)`). Other files are read through the project's [`files`](/editor-react/project#workspace-edits).

## Keyboard

The editor keeps focus, as in the peek.

| Key        | What it does                                                    |
| ---------- | --------------------------------------------------------------- |
| Up, Down   | Moves through the rows                                          |
| Home, End  | Goes to the first or last row                                   |
| Right      | Opens a node, retries after a failure, or steps into an open one |
| Left       | Folds an open node, or steps out of a closed one                |
| Enter      | Goes to the call, or loads more on the `Show more` row          |
| Escape     | Closes the tree, as does typing                                 |

Keys with a modifier stay the editor's.

A host that draws its own tree reads `CallHierarchyView` from the `callHierarchy` field of `language.popups` and calls `select(id)`, `toggle(id)`, `showMore(parent)`, `retry(id)`, `setDirection(direction)`, `go(id)` and `close()`. The tree and the peek share one widget row, so opening one closes the other.

## Accessibility

The tree is a `role="tree"` named `Call hierarchy`. Rows are `treeitem`s with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` where they have calls, and `aria-selected` when active. Focus stays in the text, which points at the tree through `aria-controls` and `aria-activedescendant` (`setInputPopup`). Each answer is announced, as in `3 callers of run`. The direction control is a radio group.

## Models

`CallNode`, `CallRow`, `CallDirection` and `CallLoad` are the types of the nodes and rows.
