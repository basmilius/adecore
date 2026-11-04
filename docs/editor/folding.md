# Folding and structure

The editor finds a document's folds and blocks from the text, and takes better ones from a language server when the host has them.

## Folding

The editor reads the model's [folding ranges](/editor-core/folding#folding-ranges) for its language shortly after the text changes. Python and YAML also fold by indentation. Line commands treat a collapsed fold as one row: delete, duplicate, comment, move and copy without a selection take its hidden lines along.

`getFolds()` returns `EditorFolds`: the `collapsed` ranges and the `custom` ones made from a selection, as zero-based lines (`EditorFoldRange`). Store it with the scroll position and caret, and pass it back as `folds` when the file reopens.

```ts
// When the file closes:
const kept = { folds: editor.getFolds(), scrollTop: editor.getScrollTop() };

// When it opens again:
const editor = engine.mount(element, { text, theme, folds: kept.folds, scrollTop: kept.scrollTop });
```

`foldDefaults` lists the [roles](/editor-core/folding#roles) that fold when a file opens without stored folds, such as `['imports', 'file-header']`. `FoldRole` is the type of each. They fold once, and nothing folds after the first edit. A range the person toggled or one holding the caret stays open. Ranges a language server names later through hints fold too.

`setFoldHints(hints)` passes what a language server knows, as `EditorFoldHints`: `symbols` (`EditorFoldSymbol`, with their `range` and `body` kind) and `ranges` (`EditorFoldRangeHint`, with their `kind`). They name the function, method and class bodies. A range with `startCharacter` or `endCharacter` folds within its first and last lines, so an import list collapses to `use …;`. `null` clears the hints.

Fold commands go through [`runCommand`](/editor/editing#commands): `collapseRegion`, `expandRegion`, `collapseAllRegions`, `expandAllRegions` and the others of `EditorViewCommand`. `foldOutline`, an `EditorFoldOutline` of `'off'`, `'hover'` or `'always'`, sets when the gutter shows the fold arrows. For the gutter controls, see [accessibility](/editor/accessibility#fold-controls).

## Blocks and sticky scroll

The editor finds a document's blocks, the stretches with a header line such as a function, from brackets and indentation. Sticky scroll pins the headers of blocks scrolled out of view, up to five lines and a quarter of the view. `onScope(listener)` reports the named blocks around the caret, outermost first, for a breadcrumb.

`setBlocks(blocks)` replaces those blocks, for example with a language server's symbols. An `EditorBlock` has one-based `startLine` and `endLine`, and an optional `name` and `kind`. `null` goes back to the editor's own.

## Selection ranges

`setSelectionRanges(provider)` lets Extend Selection use a language server's ranges. An `EditorSelectionRanges` provider gets the caret positions and resolves to the ranges around each, smallest first, or `null`. `setSelectionRanges(null)` goes back to the model's.

## Moving through a file

`runCommand('nextChange')` and `runCommand('previousChange')` (`Ctrl+Alt+Shift+ArrowDown` and `ArrowUp`) move the caret to the next or previous run of change marks from `setChangeMarks`. They do not wrap.

`setDeclarations(positions)` sets where Method Up and Down (`methodUp`, `methodDown`) stop, such as a language server's symbol names. The stops follow their text until set again. `null` goes back to the editor's own structure and Markdown headings. The commands do not wrap. `onNavigate(listener)` reports the position the caret left after Method Up and Down and the code block commands, so a host can record it for Back. `hasFocus()` tells whether the editor has keyboard focus.
