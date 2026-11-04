# Models

`@adecore/editor-react/models` exports the pure functions the features are built on, and the types of what they compute, without React or an editor. A host uses them to draw its own cards or to run the same logic elsewhere, and a test uses them without mounting anything. The helpers behind the cards are internal.

```ts
import { parseSnippet, tabOrder } from '@adecore/editor-react/models';
```

## Completion and snippets

| Export                                       | What it does                   |
| -------------------------------------------- | ------------------------------ |
| `parseSnippet`, `compileSnippet`, `tabOrder` | A snippet's text and stops     |
| `insertionOf`                                | What a completion item inserts |

[Snippets](/editor-react/snippets) explains the snippet types. `MatchDetail` and `Ranked` (how a row matched and ranks), `KindTone` (the color of a row's kind) and `RowWindow` (the rows in view) describe the completion list. `CallPlan` and `CallSite` describe the parentheses completion adds after a function.

## Hover, signatures and problems

| Export                             | What it does                           |
| ---------------------------------- | -------------------------------------- |
| `severityOf`, `codeLabelOf`        | The severity and label of a diagnostic |
| `decodeSemanticTokens`, `scopesOf` | Semantic tokens as scopes              |

A `Problem` is a diagnostic as the features hold it. The hover card's content is a `HoverText` of `HoverSection`s: a `SignatureBlock`, Markdown as `MarkdownPart`s, `DocTag`s and a browser-support `Baseline` with its `BaselineLevel`. The signature card draws a `SignatureViewModel`.

## Navigation, rename and actions

| Export                  | What it does                               |
| ----------------------- | ------------------------------------------ |
| `distinguishingFolders` | The folders that tell peeked files apart   |
| `ResourceOperationView` | The files an edit makes, moves and deletes |

The types of what these features show:

- Rename: a `RenameTarget` is the range and placeholder a server gives, `Occurrences` counts the places of the name in this file and in all files, and the preview has a `RenameFile` of `RenameRow`s, each a line before and after.
- Peek: a `PeekFile` holds the `PeekPlace`s of one file, each a line with the name's `NameRange`, and a `PeekSnippet` is the few lines drawn as a preview.
- Call hierarchy: `CallDirection`, `CallLoad`, `CallNode` and `CallRow`; see [call hierarchy](/editor-react/call-hierarchy#models).
- Symbol picker: a `SymbolEntry` is one symbol of the file, sorted into a `SymbolGroup` (classes, functions and so on) and colored by its `SymbolTone`. An `EntryGroup` holds the entries of one group, a `WorkspaceEntry` is a symbol of the project, and `PickerMode` is what the input asks for: symbols, the project (`#`) or a line (`:`).
- Code actions: an `ActionEntry` is a server's action in its `ActionGroup`, such as `quickfix` or `extract`, and an `EditPreview` is the lines an edit takes away and puts back in the open file.
- Code vision: a `CodeVisionDeclaration` is a declaration with the line its row sits above, read from a `DeclarationSource` of lines. A `CodeAuthorship` lists the `CodeAuthor`s of a declaration by lines written, with its uncommitted lines.

## Proposals and diffs

| Export                                                           | What it does                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `parseAnswer`                                                    | The last closed `replacement` fence of a Markdown answer, and the rest            |
| `fitReplacement`, `endOfInsertion`                               | A replacement in the line breaks of the text it replaces                          |
| `lineSpanOf`, `inlineRangeOf`, `isEmptyRange`, `problemsOnLines` | The stretch a proposal is about                                                   |
| `locateSelection`, `replaceRange`                                | Finding and replacing text by position                                            |
| `diffSegments`, `emphasisOf`, `replacedWords`                    | The segments and changed words `ChangeReview` draws                               |
| `replaceLines`, `replaceAllLines`                                | Replacing whole lines                                                             |
| `planConflict`                                                   | The stretches of a three-way merge that need a person                             |
| `patchLayoutOf`                                                  | The role, numbers and files of every line of a [patch](/editor-react/patch-files) |

````ts
import { parseAnswer } from '@adecore/editor-react/models';

parseAnswer('Shorter:\n```replacement\nconst total = sum(lines);\n```\nIt reads better.');
// { replacement: 'const total = sum(lines);', rest: 'Shorter:\nIt reads better.' }
````

Their types: `LineSpan`, `InlineProblem` and `InlineAnswer` for a proposal, `DiffSegment` for `diffSegments`, `LineReplacement` for `replaceLines`, and `ConflictStretch` and `ConflictPlan` for `planConflict`. [Patch files](/editor-react/patch-files) explains `PatchLayout`, `PatchLayoutLine`, `PatchLineRole`, `PatchFileLayout`, `PatchFileStatus`, `PatchHunkLayout` and `PatchLimits`.

## Find and placement

| Export                                                                     | What it does                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `compileFind`, `matchesIn`, `stepIndex`, `EMPTY_FIND_QUERY`, `MATCH_LIMIT` | A find query checked, run over a text, and stepped through |

A `FindQuery` with its `FindOptions` compiles to a `CompiledFind`, which finds `TextMatch`es. These are the find bar's own model, apart from the editor's [matcher](/editor/find).

`PopupSize`, `PopupPlacement` and `PlaceOptions` describe where a card sits beside its anchor; [`AnchoredPopup`](/editor-react/editor-view#anchoredpopup) takes `PlaceOptions` as its `placement`.
