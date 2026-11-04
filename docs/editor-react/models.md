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

- Rename: `RenameTarget`, `Occurrences`, `RenameRow` and `RenameFile`.
- Peek: `NameRange`, `PeekPlace`, `PeekFile` and `PeekSnippet`.
- Call hierarchy: `CallDirection`, `CallLoad`, `CallNode` and `CallRow`; see [call hierarchy](/editor-react/call-hierarchy).
- Symbol picker: `SymbolGroup`, `SymbolTone`, `SymbolEntry`, `EntryGroup`, `PickerMode` and `WorkspaceEntry`.
- Code actions: `ActionGroup`, `ActionEntry` and `EditPreview`.
- Code vision: `CodeVisionDeclaration` and `DeclarationSource` for the usage rows, `CodeAuthor` and `CodeAuthorship` for the authors.

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
