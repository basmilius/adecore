# Compilation and streaming

The compiler turns a reply's text into `UiBlock` objects: the parsed tree, the declarations, the diagnostics and a text fallback per block. It runs on the backend, on every preview and once on the final text. Its output is JSON.

## compileUi

```ts
import { compileUi } from '@adecore/intelligent-ui/compiler';

const blocks = compileUi(replyText, { id: itemId, final: true, fenceLanguage: 'ui', querySchemas });
```

`compileUi(text, options)` finds every UI fence in Markdown, unfinished ones included, and compiles each. `compileUiBlock(source, options)` compiles the contents of one fence. `UiCompileOptions`:

| Option             | What it does                                                                        |
| ------------------ | ----------------------------------------------------------------------------------- |
| `id`               | The reply's id. Block ids are `<id>:ui:<offset>`; pass the same id on every recompile |
| `final`            | The text is complete: unfinished syntax is reported and every block is complete     |
| `fenceLanguage`    | The info string of a UI fence, `UI_FENCE_LANGUAGE` (`ui`) without one               |
| `querySchemas`     | The argument schema of every source a `@Query` may name                             |
| `latestAttachment` | The attachment id that `Image generated="latest"` stands for                        |
| `limits`           | Overrides of `UI_LIMITS` for each block                                             |
| `now`              | The clock for an enabled time budget                                                |

Node ids are the block id and the tag's start offset, so they stay stable while a block grows.

## UiBlock

| Field            | Holds                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| `id`             | Stable across recompiles of the same reply                               |
| `catalogVersion` | `UI_CATALOG_VERSION` of the compiler that wrote it                       |
| `revision`       | Optional; a host sets it on a final block, the compiler never does       |
| `start`, `end`   | The fence's range in the reply, in UTF-16 units                          |
| `complete`       | The fence closed, or the reply is final                                  |
| `defaults`       | The declared variables and their literal defaults                        |
| `queries`        | Each `UiQuery`: `source`, `args` with the defaults, and the `expression` when an argument reads state |
| `nodes`          | The `UiNode` tree                                                        |
| `diagnostics`    | `UiDiagnostic` objects                                                   |
| `fallback`       | The block as plain text, for a client that cannot draw it                |

A `UiNode` keeps static `props` apart from `expressions` and `bindings` (prop name to variable). Its `type` is a string, so a component from a newer catalog draws as its fallback. Its `complete`, `fallback`, `error` and range follow the block's rules.

`UiBlockSchema`, `UiBlocksSchema`, `UiNodeSchema` and `UiDiagnosticSchema` validate the wire shapes. They leave component names, props and expressions open, so an older client shows a newer block as fallback instead of rejecting the reply.

## UiCompiler

`UiCompiler` recompiles a streaming reply, reusing blocks of fences that did not change.

```ts
import { UiCompiler } from '@adecore/intelligent-ui/compiler';

const compiler = new UiCompiler({ id: itemId, querySchemas });
const preview = compiler.compile(textSoFar);
const final = compiler.compile(finalText, { final: true, latestAttachment });
compiler.clear();
```

`UiCompilerOptions` are the stable options; `UiCompileUpdate` carries `final` and `latestAttachment` per call. A final call recompiles every block, the unfinished last one included. `clear()` drops the cache.

## UiStream

`UiStream` throttles a `UiCompiler`. `update(text, latestAttachment?)` takes the whole text so far. The first update compiles at once, later ones at most every `UI_STREAM_INTERVAL_MS` (250 ms), and each calls `emit` with a `UiStreamPreview` of `blocks` and `textLength`. `finish(text, latestAttachment?)` cancels a pending preview and returns the final blocks. `dispose()` stops without a result.

`UiStreamOptions` adds `emit` and a `UiStreamClock` (`now`, `setTimeout`, `clearTimeout`) to the compiler options. Previews are for attached clients; store only what `finish` returns.

## Cheap tests

Two checks skip work for replies without blocks:

- `uiHasFence(text, fenceLanguage?)`: whether the text opens a UI fence.
- `uiMayReferenceHost(text)`: whether it may declare a query or name a link target, before any access is captured.

## Limits

`UI_LIMITS` bounds the work of one block, and `UiLimits` is its type. A `UiBudget` counts against it.

| Key           | Default | Bounds                                     |
| ------------- | ------- | ------------------------------------------ |
| `characters`  | 65,536  | The source of one block                    |
| `depth`       | 32      | Nesting of tags and expressions            |
| `nodes`       | 512     | Tags, text and expression nodes            |
| `diagnostics` | 20      | Diagnostics kept per block                 |
| `steps`       | 262,144 | Parser and interpreter steps               |
| `iterations`  | 2,000   | Items of lists, records, `Each` and helpers |
| `stringLength`| 16,384  | One string or expression                   |
| `milliseconds`| 0       | Optional elapsed-time limit; zero disables it |

Complex expressions can exceed the step, iteration or output limits even when their source fits the character limit.

A host may pass overrides, a `Partial<UiLimits>`, as the last argument of `new UiState`, `evaluateUiBlock`, `uiValidatedState`, `uiLinkTargets` and `resolveUiChoice`, and as the fourth of `uiQueryArguments`. `UI_LIMITS` itself never changes. A positive `milliseconds` enables an elapsed-time check, whose result depends on machine load. Every other limit must be a positive safe integer.

`UI_REPLY_LIMITS` bounds a whole reply: 16 blocks, 262,144 UTF-16 units of UI source and 2,048 compiled nodes. The block that crosses a limit becomes its text with one `budget_exceeded` diagnostic, and later fences stay text.

## Diagnostics and failures

A refusal anywhere in the package is a `UiFailure`, an `Error` with a machine-readable `code`. `uiDiagnostic(error, start, end, nodeId?)` turns any caught error into a `UiDiagnostic`, with `invalid_syntax` for other errors. `safeKey(key)` throws `refused_access` for `__proto__`, `constructor` and `prototype`. [Syntax](/intelligent-ui/language/syntax#diagnostics) lists the codes.

The agents host puts up to six diagnostics of a final reply into one note before the agent's next prompt.

## Fallbacks

Every node and block carries a text fallback that clients show and other agents read. It keeps every prop with meaning: a Step as `title (state): detail`, a Stat as `label: value unit (was previous unit)`, a Table as its columns and rows in JSON, and so on. Styling and state props (a tone, `primary`, a control's value) are left out. A failed part shows its own fallback while its neighbors still draw. A stored block keeps the fallback it was compiled with.

`uiFallbackText(text, blocks)` replaces every fence of a reply with its fallback, for a notification, a search index or a client without a renderer. With [`@adecore/agents`](/agents/chats#live-ui-sources), `readableAssistantText(item)` does this for a stored reply. `uiQueryFallback(block, values)` evaluates the fallback with query readings; see [live queries](/intelligent-ui/host/queries#freshness).

## The catalog in code

`UI_CATALOG` holds every component: its `group`, `description` and zod `schema`, with `parent`, `children`, `binding` or `action` where it has one. A `parent` is one name or a list. `UI_GROUPS` holds each group's description and rules, and `UiGroupName` is the union of its keys. `UiComponentName` is the union of the catalog's keys and `UiProps<Name>` the props a schema accepts. `isUiComponent(name)` checks a name. `UiToneSchema` validates a `UiTone`. `UI_CATALOG_VERSION` changes on incompatible changes; a block of another version draws as its fallback.

Text for an agent or a tool comes from the same schemas:

| Function            | Gives                                                              |
| ------------------- | ------------------------------------------------------------------ |
| `uiSessionNote(options?)`   | The short instructions for every session                   |
| `uiReferenceText(options?)` | The full reference: syntax, example, groups, rules, components |
| `uiGroupReference(group)`   | One group of that reference: description, rules, components with props |
| `uiCompactCatalog()`        | `Name: prop,prop?` for every component, on one line        |
| `uiCatalogText()`           | `Name(props): description`, one line per component         |

`uiSessionNote` and `uiReferenceText` take `UiTextOptions` with the compiler's `fenceLanguage`. The note also takes `catalog` (`'props'` by default, or `'names'`) and `detailHint`; see [tell the agent](/intelligent-ui/guide/getting-started#tell-the-agent).

## The syntax tree

`parseUiSyntax(source, id, final?, budget?)` is the compiler's first stage. It returns a `UiSyntax`: `declarations` as expression trees, `nodes` as `UiSyntaxNode` objects with unevaluated props, and `diagnostics`. Use it for tooling, such as a linter.
