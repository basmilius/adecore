# Snippets

A completion item with `insertTextFormat: 2` is a snippet: text with stops to fill, in the [LSP snippet syntax](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#snippet_syntax). [Live templates](/editor-react/templates) and Emmet insert through the same session.

## Fields and stops

Tab and Shift+Tab walk the stops, `$0` last. The session ends at the last stop, when the caret leaves, on undo or on Escape (which keeps only the primary caret). Stops with the same index mirror each other, also across several carets. The session announces each field visit as `Field N of M`; see [accessibility](/editor-react/accessibility).

The session visits nested placeholders in numeric order, and replacing a parent removes its nested stops. Variables resolve per insertion. A known variable without a value inserts its default; an unknown one becomes a placeholder holding its name, visited before `$0`. A choice inserts its first value and opens a picker: Enter or a click applies a value, Tab moves on, typing edits the field, and the first Escape closes the picker. Variable transforms run before insertion and field transforms when Tab leaves a field, both only with a [worker](#isolated-transforms). An unsupported transform keeps the untransformed value.

## Parsing a snippet

```ts
import { parseSnippet, tabOrder } from '@adecore/editor-react/models';

const snippet = parseSnippet('print(${1:value}, ${2:count})$0');
snippet.text; // 'print(value, count)'
tabOrder(snippet).map((stop) => stop.index); // [1, 2, 0]
```

`parseSnippet` returns a `ParsedSnippet` with `text`, `stops` and optional `fields`, `transforms` and `limited`. A `SnippetField` groups the UTF-16 `SnippetRange` offsets of one index, with its `primary` occurrence, `linked` child copies, `parents` and `choices`. `SnippetTransform` is the pattern, flags and format of an occurrence. `tabOrder` returns one `SnippetStop` per index, in visiting order. Oversized snippets insert their source text without a session.

## Variables and indentation

`parseSnippet(source, resolve?)` takes a synchronous `SnippetVariableResolver`. `compileSnippet(source)` returns a reusable `SnippetTemplate`; its `render(resolve?, variableTransforms?, options?)` resolves each variable once per render. Values are literal text, so a `$` in a filename never makes a stop. `insertionOf` returns the `Insertion` of a completion item and takes `SnippetInsertionOptions` with the resolver, a compiled template, `indentationBefore` and the `variableTransforms` results. `{ indentVariables: true }` indents the later lines of a multi-line value to the line the variable starts on, as VS Code does with `TM_SELECTED_TEXT`.

Completion resolves the usual LSP variables: selection, line and word, line and cursor numbers, file and workspace paths, date and time, random values and UUID. A synchronous `LanguageHost.resolveSnippetVariable(name, context)` overrides them or adds names, comment markers and clipboard text; the editor never reads the clipboard itself. `SnippetVariableContext` describes the insertion: URI, language, position, selection, line and word, cursor index and count, workspace folder and path. A throwing override falls back to the built-ins.

```ts
const project = new ProjectLanguage(service, {
    folder,
    resolveSnippetVariable: (name, context) => (name === 'AUTHOR' ? currentUser.name : undefined)
});
```

`insertTextMode: 2` indents every later line by the whitespace before the insertion; `1` or none keeps the text as is. Completion refuses an oversized or `limited` result before any edit and tells the host. See the [LSP indentation modes](https://github.com/microsoft/language-server-protocol/blob/gh-pages/_specifications/lsp/3.18/language/completion.md).

## Completion inside a snippet

Completion inside an active field updates its mirrors and keeps the outer stops. A completion with fields of its own starts a nested session: Tab visits its fields, then the next outer field. Shift+Tab from its first field selects the parent field. Escape and undo end every level. The session leaves out malformed items and ranges.

`snippets.token` changes on every field visit. `snippets.applyEdits(changes, token, extras?)` applies a completion or choice edit inside the session; `extras` lists imports outside it. A stale token ends the session first. `beginInstances(insertions, { nested: true })` keeps the enclosing session; `begin` starts fresh. Too deep a stack starts fresh. `PickSpec.onTab(backwards)` lets a pick list close and pass Tab on.

Inside a nested snippet, a `$0` generated after unlinking sorts after a stop of the enclosing snippet at the same point.

## Isolated transforms

Transforms (`${1/(.*)/${1:/upcase}/}`) run server regular expressions, so they run in a worker, never on the page. `LanguageHost.snippetTransformWorker` supplies the worker factory, and the worker calls `serveSnippetTransforms(self)`. Without a worker, or on a timeout, values stay untransformed. A syntax error, an oversized batch or a crashed worker refuses the insertion with a notice. A full queue refuses it with a busy notice. Editors of one project share one client and must inject the same clock.

```ts
// snippet-transforms.worker.ts
import { serveSnippetTransforms } from '@adecore/editor-react/snippet-transform-worker';

serveSnippetTransforms(self);
```

`@adecore/editor-react/snippet-transform-worker` exports `serveSnippetTransforms`, `createSnippetTransformClient`, `compileSnippetTransformFormat`, `SnippetTransformError` and their protocol, job, client and endpoint types, and imports no React:

| Name                                              | What it is                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `SnippetTransformJob`                             | A value, pattern, flags (`gimsu`) and `SnippetTransformFormatNode` format |
| `SnippetTransformCase`                            | `upcase`, `downcase`, `capitalize`, `camelcase`, `pascalcase`             |
| `SnippetTransformInput`, `SnippetTransformOutput` | The request and reply unions                                              |
| `SnippetTransformWorkerEndpoint`                  | The port the worker serves                                                |
| `SnippetTransformClientOptions`                   | The worker factory, `deadline` (1,500 ms) and `schedule`                  |
| `SnippetTransformClient`                          | `transform(jobs)` returns the strings; `cancel`, `release`, `dispose`     |
| `SnippetTransformErrorKind`                       | Protocol error, timeout or lifecycle failure                              |

A timeout terminates the worker. `release` frees it and keeps the client usable; `dispose` is final. Keep this client apart from the one find uses. `Insertion.variableTransforms` holds the jobs of an insertion.

### Field-exit transforms

A transformed mirror shows the raw value while its field is active. Tab or Shift+Tab transforms it, and navigation goes on without waiting. Applying the result is its own undo step: the first undo restores the raw text. Escape, undo and other edits cancel a pending exit. A failed field-exit transform leaves the raw value without a notice.
