# @adecore/intelligent-ui

A streaming compiler and bounded expression interpreter for UI blocks in agent replies. The catalog defines props once with Zod. Renderers consume evaluated props and input bindings; they do not evaluate model text.

Chat wire integration and scheduling are provided by `@adecore/agents`; React renderers are provided by `@adecore/agents-react`. Hosts supply actions, query authorization and platform renderers. The compiler and interpreter do not authorize a query or an action.

```ts
import { compileUi, evaluateUiBlock, UiState } from '@adecore/intelligent-ui';

const blocks = compileUi(reply, { id: assistantItemId, final: true });
for (const block of blocks) {
    const state = new UiState(block);
    const view = evaluateUiBlock(block, state);
    render(view.nodes);
}
```

## Compilation

`compileUi(text, options)` finds blocks marked with `UiCompileOptions.fenceLanguage`, or `UI_FENCE_LANGUAGE` (`ui`) without one, among Markdown, including unfinished fences. It ignores UI fences nested inside another code fence. Each `UiBlock` has its own ID, text range, catalog version, declarations, nodes, diagnostics and Markdown fallback. `compileUiBlock(source, options)` compiles one fence's contents. `uiHasFence(text, fenceLanguage?)` is a cheap test for an opening fence before a compiler is worth creating.

`UiCompileOptions.id` identifies the assistant item or block. Supply the same ID on each recompile. Node IDs include the start of their tag, so appending text preserves them. `final` reports unfinished syntax when the authoritative response arrives. `latestAttachment` resolves `Image generated="latest"` to an attachment. `limits` overrides the work budget; `now` supplies a clock for deterministic tests.

The parser recovers at the next tag or line after malformed input. Open tags remain incomplete. A streamed quoted prop exposes the text already received. CodeBlock contents are literal, including angle brackets and braces. Unknown components retain their own fallback; unknown props produce `refused_prop` and are dropped. A budget failure replaces the whole compiled block with a bounded fallback and one diagnosis.

`UiNode` keeps static `props` separate from `expressions` and local-variable `bindings`. Its `type` is a string so an unfamiliar component can fall back without rejecting neighboring content. `UiNodeSchema`, `UiBlockSchema`, `UiBlocksSchema` and `UiDiagnosticSchema` describe the wire envelope. Component names, props and expressions stay open, so a future catalog can be retained and shown as fallback. The optional assistant field and daemon integration still await the package's first publication setup.

`parseUiSyntax` exposes the intermediate `UiSyntax` and `UiSyntaxNode` for compiler tooling. `UiDiagnostic` carries a code, message, source range and optional node ID. `uiDiagnostic` turns a caught failure into that shape.

## Catalog

`UI_CATALOG` contains each component's schema, description, group and applicable parent, child or binding rule. `UI_GROUPS` contains the instructions shared by each group. `isUiComponent` recognizes a catalog name; `uiCatalogText` lists names, props and descriptions for tooling. `uiCompactCatalog` derives the short prop list from those schemas, `uiSessionNote` adds explicit tag syntax and a fenced example checked by the compiler, and `uiReferenceText` combines full descriptions with group rules. Both take `UiTextOptions` with the same `fenceLanguage` as the compiler. `uiFallbackText` replaces UI fences with their compiled fallback while retaining surrounding prose.

`UiComponentName` is the key union. `UiProps<Name>` is inferred from that component's schema. `UiToneSchema` and `UiTone` provide neutral, info, success, warning and danger. `UI_CATALOG_VERSION` identifies this catalog.

| Group | Components |
| --- | --- |
| Status | Summary, Callout, Tag, Progress, Steps / Step |
| Data | Stats / Stat, EntityList / Entry, Table / Column, Chart |
| Structure | Tabs / Tab, Sections / Section |
| Content | CodeBlock, Image, Sources / Source |
| Host links | File, Diff, Commit, Node |
| Local inputs | Checklist / Item, Switch, Slider, Segmented / Option, Show, Each |
| Choices | Choices / Choice |

Image accepts exactly one of `attachment` and `generated="latest"`, plus an optional alt and caption. It never takes a URL or a filesystem path. Charts use rows with a label and numeric series; their renderer will validate usable series before drawing. A Column names a field and optionally its title, unit and presentation.

## Expressions and state

`parseUiExpression(source, budget?)` returns a `UiExpression` AST. `evaluateUiExpression(ast, variables?, budget?)` returns a finite JSON `UiValue`. It supports scalar, array and object literals, variables, own field/index reads, arithmetic, strict comparisons, boolean operators and these helpers:

| Helper | Arguments |
| --- | --- |
| `@Count` | list or string |
| `@Filter` | list, local name, boolean predicate, e.g. `@Filter($rows, row, row.failed)` |
| `@Sum` | numeric list, or record list and a field name |
| `@Join` | scalar list and optional separator |
| `@Round` | number and optional precision from zero to six |

There is no JavaScript execution, general function call, assignment, network access or inherited field access. `__proto__`, `constructor` and `prototype` are refused. `copyUiValue` validates and copies JSON input without invoking accessors; class instances, nonfinite numbers, sparse arrays and cycles are refused.

`UiState` belongs to one chat/item/block identity. `sync(block)` preserves edits when a declaration's default is unchanged, resets changed defaults, removes disappeared variables and clears changed query data. A reload creates a new state from defaults. `scope()` returns a safe copy. `set(name, value)` changes a declared local variable without changing its type. `run(ast)` accepts only `@Set($name, expression)`, `@Reset($name)` and `@Reset()`. `snapshot()` and `subscribe(listener)` let a renderer observe input edits.

`evaluateUiBlock(block, state?, limits?)` returns `UiEvaluation`, including `UiViewNode` objects and per-element diagnostics. View nodes contain validated evaluated props, children and `UiBinding` callbacks. A binding changes state only after its input node is complete and the new prop passes its schema. Show and Each are resolved before rendering. Repetition reserves iterations before allocating children. Unknown catalog versions and invalid elements retain their fallback.

`$name = @Query("source", {literalArgs})` requires a matching schema in `UiCompileOptions.querySchemas`. It yields a read-only `UiQuery`; ordinary value evaluation never performs a query. The authorized host may supply data with `state.setQuery(name, value, block)`. Results for replaced query definitions are refused. Transport, quotas, rights, fixed versus variable arguments and visible-only refresh still belong to the upcoming host integration.

## Budgets and acceptance

`UI_LIMITS` bounds characters, nesting, nodes, diagnoses, steps, iterations, string length and elapsed time. `UiLimits` describes overrides. `UiBudget` counts work inside helpers as well as ordinary evaluation. `UiFailure` carries a machine-readable refusal code; `safeKey` applies the forbidden-field rule.

The tests compile ten hand-written examples and every character prefix, then exercise malformed syntax, prototype/accessor attacks, helper budgets, output expansion, query replacement and state reset. Recorded Claude/Codex responses, daemon event-loop/log measurements and iPhone JavaScriptCore parity remain acceptance work. The package does not yet render replies in an application.
