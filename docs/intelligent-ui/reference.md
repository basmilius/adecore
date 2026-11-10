# Reference

Every name each entry point exports, types included, read from its source. Anything not listed is internal and may change in any release. The root exports every name of the subpaths below; a subpath holds one part, for a page that wants to import less.

## Where each is described

| Topic | Page |
| --- | --- |
| The catalog, `uiSessionNote`, `uiGroupReference`, `uiReferenceText`, `uiFallbackText` | [Compilation and streaming](/intelligent-ui/host/compilation#the-catalog-in-code) |
| `compileUi`, `UiCompiler`, `UiStream`, the limits | [Compilation and streaming](/intelligent-ui/host/compilation) |
| Expressions and the value helpers | [Expressions](/intelligent-ui/language/expressions#from-code) |
| `UiState`, `evaluateUiBlock`, bindings and actions | [State and inputs](/intelligent-ui/language/state#uistate) |
| `@Query`, `uiQueryArguments`, `uiQueryFallback` | [Live queries](/intelligent-ui/host/queries) |
| `resolveUiChoice`, `uiChoiceLabel`, `uiInputValues`, `uiValidatedState` | [Choices](/intelligent-ui/host/choices) |
| `parseUiEventTime` | [Status](/intelligent-ui/components/status#timeline-and-event) |
| `uiLinkTargets` and the link schemas | [Links](/intelligent-ui/host/links) |
| `UiBlockSchema`, `UiNodeSchema` and the types inferred from them | [Getting started](/intelligent-ui/getting-started#the-wire) |
| `uiGroupDescription` and the `places` option | [Compilation and streaming](/intelligent-ui/host/compilation#the-catalog-in-code) |
| `uiNodeQueries` | [Live queries](/intelligent-ui/host/queries#freshness) |

## `@adecore/intelligent-ui`

Every name below, from one import.

<ExportTable entry="@adecore/intelligent-ui" />

## `@adecore/intelligent-ui/catalog`

The components, their props and the group rules.

<ExportTable entry="@adecore/intelligent-ui/catalog" />

## `@adecore/intelligent-ui/compiler`

`compileUi`, `UiCompiler` and the reply and host limits.

<ExportTable entry="@adecore/intelligent-ui/compiler" />

## `@adecore/intelligent-ui/stream`

`UiStream`, the throttled compiler for a streaming reply.

<ExportTable entry="@adecore/intelligent-ui/stream" />

## `@adecore/intelligent-ui/syntax`

The parser's intermediate tree and its diagnostics.

<ExportTable entry="@adecore/intelligent-ui/syntax" />

## `@adecore/intelligent-ui/expression`

The expression parser, the interpreter and the value helpers.

<ExportTable entry="@adecore/intelligent-ui/expression" />

## `@adecore/intelligent-ui/runtime`

`UiState`, `evaluateUiBlock` and `resolveUiChoice`.

<ExportTable entry="@adecore/intelligent-ui/runtime" />

## `@adecore/intelligent-ui/query`

Validated inputs, query arguments and the query fallback.

<ExportTable entry="@adecore/intelligent-ui/query" />

## `@adecore/intelligent-ui/links`

Link targets and the host's resolution.

<ExportTable entry="@adecore/intelligent-ui/links" />

## `@adecore/intelligent-ui/protocol`

Zod schemas of compiled blocks on the wire, and the `UiBlock`, `UiNode`, `UiQuery` and `UiDiagnostic` types inferred from them.

<ExportTable entry="@adecore/intelligent-ui/protocol" />

## `@adecore/intelligent-ui/text`

The instructions for the agent and the text fallback.

<ExportTable entry="@adecore/intelligent-ui/text" />

## `@adecore/intelligent-ui/event-time`

The time of an `Event`, read from its text.

<ExportTable entry="@adecore/intelligent-ui/event-time" />

## `@adecore/intelligent-ui/budget`

The work limits and the refusal type.

<ExportTable entry="@adecore/intelligent-ui/budget" />
