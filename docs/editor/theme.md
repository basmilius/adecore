# Theme and syntax

The page theme colors the editor's chrome and the syntax theme colors the code. They are separate: the page goes dark with `data-theme="dark"`, the code with `setTheme('github-dark')`. Change both together.

## CSS tokens

`editor.css` defines its tokens on `:root` and `[data-theme]`, on top of the [`@adecore/ui` theme](/ui/guide/theme). An app without that theme defines `--surface`, `--surface-raised`, `--surface-hover`, `--border`, `--text`, `--text-muted`, `--text-faint`, `--accent`, `--status-error`, `--status-idle`, `--status-needs-you`, `--status-running`, the radii, `--font-sans`, `--font-mono`, `--text-xs` and `--text-code` itself. Override any token after the import.

| Token                                                                      | What it colors or sizes                                                                                           |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `--code-font-size`, `--code-line-height`                                   | The code; `--text-code` and its line height by default                                                            |
| `--font-mono`                                                              | The code face                                                                                                     |
| `--editor-selection`, `--editor-occurrence`                                | The selection and the marks of the other uses of the selected text                                                |
| `--editor-guide`, `--editor-guide-active`                                  | Indent guides, and the guide of the block around the caret                                                        |
| `--editor-margin`, `--editor-whitespace`                                   | The right margin and the dots and arrows of whitespace                                                            |
| `--editor-added`, `--editor-modified`, `--editor-deleted`                  | Change marks                                                                                                      |
| `--editor-todo`                                                            | [TODO comments](/editor/options#todo-comments) and their ticks in the scroll track                                |
| `--editor-mark-number-mix`, `--editor-mark-bar-width`, `--editor-mark-gap` | Line number shade, bar width and the gap between the tinted number cell and the code, of a highlight with a `bar` |
| `--find-match`, `--find-current`, `--find-current-text`                    | Find matches                                                                                                      |
| `--agent-1` to `--agent-6`, `--agent-ink`                                  | [Agent](/editor/agents) colors and the text on them                                                               |
| `--term-fg`                                                                | The code's text color when set; `--text` otherwise                                                                |

Call `refreshFont()` after the font tokens change.

## Shiki

`shikiTokenizers` adapts a Shiki highlighter to the engine, and `shikiScopeColors` supplies a theme's colors by scope for [semantic tokens](#semantic-colors). Both take a function returning the highlighter, so it loads on first use and other code viewers can share it.

```ts
import { createHighlighter, type Highlighter } from 'shiki';
import { createSmartEditorEngine, shikiScopeColors, shikiTokenizers } from '@adecore/editor';

let highlighter: Promise<Highlighter> | undefined;
const getHighlighter = (): Promise<Highlighter> => (highlighter ??= createHighlighter({ themes: [], langs: [] }));

const engine = createSmartEditorEngine({
    tokenizer: shikiTokenizers(getHighlighter),
    scopeColors: shikiScopeColors(getHighlighter)
});
```

The adapter loads languages and themes by Shiki id on first use. An unknown or failing one is plain text. Embedded languages, such as `lang="scss"` in a Vue file or a Markdown code fence, load when the text names them, also while editing. For `php` the whole file colors as HTML with PHP between its tags. PHP inside an HTML attribute is not colored.

`loadGrammar(highlighter, grammar, text?)` and `documentLanguageOf(language)` from `@adecore/editor/shiki` are the adapter's steps, for a code viewer that colors the same way.

## A viewer split into blocks

`shikiDocumentHighlighter(getHighlighter, blocks, language, theme, transformers?)` from `@adecore/editor/shiki` returns `(index) => Promise<string>` of HTML for an immutable document split into blocks of whole lines, without a trailing line break. Grammar state carries across blocks, so a multiline comment or embedded language continues.

```ts
import { shikiDocumentHighlighter } from '@adecore/editor/shiki';

const highlightBlock = shikiDocumentHighlighter(getHighlighter, ['/* opening', 'still a comment */'], 'typescript', 'github-dark');
const html = await highlightBlock(1);
```

A later block first highlights its predecessors, yielding between blocks. Results are cached. Creating the helper loads nothing. Unsupported languages render as plain text. A failed load rejects and can be retried. An invalid index rejects with `RangeError`. Create a new helper when the text, language, theme or transformers change. Register custom themes on the shared highlighter before `getHighlighter` returns it.

## Tokens for a document

`shikiDocumentTokens(getHighlighter, blocks, language, theme, options?)` from `@adecore/editor/shiki` works like `shikiDocumentHighlighter` but returns `(index) => Promise<ThemedToken[][]>`, one token array per line, with `offset` relative to the block. Treat results as immutable. Token text is literal, so use text nodes or escape it.

```ts
import { shikiDocumentTokens } from '@adecore/editor/shiki';

const tokens = shikiDocumentTokens(getHighlighter, ['/* opening', 'still a comment */'], 'typescript', 'github-dark');
const secondBlock = await tokens(1);
```

For a patch without whole-file snapshots, set `options.reset` to the indexes of blocks that start a hunk, since grammar state cannot cross omitted lines. Old and new sides need separate tokenizers. `ShikiDocumentTokenOptions` also takes Shiki's `tokenizeMaxLineLength` and `tokenizeTimeLimit` (defaults unlimited and 500 milliseconds per line). Set both for untrusted or minified text. Longer lines stay uncolored.

## Diff syntax in a worker

`@adecore/editor/shiki-worker` exports `serveDiffSyntax(endpoint)`. A worker entry calls it with `self`; importing registers nothing. The returned function stops the service and disposes its highlighter.

```ts
// syntax.worker.ts
import { serveDiffSyntax } from '@adecore/editor/shiki-worker';
serveDiffSyntax(self);
```

A `DiffSyntaxWorkerEndpoint` supplies message listeners and `postMessage(message, { transfer })`. `DiffSyntaxInput` messages are:

| Type      | Payload                                    | Behavior                                                                                                                                                   |
| --------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`   | `themes`, `maxLines`                       | Loads custom themes, clears earlier documents and sets the cache budget in lines                                  |
| `themes`  | `themes`                                   | Loads custom themes added later. A theme that fails only fails the requests that use it                           |
| `request` | `generation`, `index`, optional `document` | Returns tokens for a block. Send the `document` on the first request and after a `missing` failure               |
| `cancel`  | `generation`                               | Drops queued requests and late responses, keeping computed tokens                                                 |
| `dispose` | `generation`                               | Cancels requests and removes the document from the cache                                                          |

A `DiffSyntaxDocument` has `language`, `theme`, `blocks` and `resets` (blocks that start a hunk). The host allocates positive generation numbers and takes a new one whenever text, language, theme or blocks change. A side with zero lines has no blocks and needs no request. Use blocks of about 200 lines. The newest request goes first. Lines over 10,000 UTF-16 units stay uncolored.

Over `maxLines` the cache evicts the least recently used idle generations. A request for an evicted generation fails with `reason: 'missing'`; resend its document.

`DiffSyntaxOutput` reports `ready`, `error`, `failed` or `tokens`. A `DiffSyntaxTokens` packet holds the theme's foreground and background, a color dictionary and two transferable `Uint32Array` buffers, `lines` and `tokens`. `lineTokensOf(packet, line, sourceText)` decodes one zero-based block line into `LineToken`s, and throws `RangeError` for an invalid line. Cache the result while packet and line are unchanged. The worker sends no text, so build text nodes from the source.

`createSyntaxService(options)` runs the same queue and cache on the main thread, as a fallback when the worker fails. `DiffSyntaxServiceOptions` takes the shared highlighter, a `send` callback and an optional async `yield`. The `DiffSyntaxService` has `handle(message): Promise<void>` and `dispose()`, which leaves the borrowed highlighter alone. A `failed` message carries a generation and block index, with `reason: 'highlight'` for a grammar or theme failure. `error` reports a failed start or invalid input. Send another `start` to retry.

## A tokenizer of your own

A `TokenizerSource` is `(language, theme, text?) => Promise<LineTokenizer | null>`. A `LineTokenizer` colors one line at a time, from the state the line before it ended in:

- `tokenizeLine(text, state)` returns a `TokenizedLine`: `tokens`, whose `length`s sum to the line's length, and the `state` the next line starts from. The first line gets `null`. A `LineToken` has a CSS `color` (empty for default) and a `fontStyle` of Shiki's flags: 1 italic, 2 bold, 4 underline, 8 strikethrough.
- `sameState(left, right)` tells where recoloring after an edit can stop. A wrong `true` leaves stale colors below the edit.
- `prepare?(text)` loads embedded grammars the text names. It resolves to `true` when the load can change earlier lines.
- `stale?()` returns `true` once after a grammar rebuild, so coloring restarts from the top.

The editor colors the visible lines plus a margin and recolors from the changed line down. The demos use a tokenizer of about forty lines, `docs/demos/shared/editor.ts`, that colors TypeScript keywords, strings, numbers and comments.

## Semantic colors

`setSemanticTokens` takes ranges with TextMate scopes, and `scopeColors(theme)` picks the theme's color for each scope stack. A scope the theme does not style keeps the grammar's color. A tokenizer may set a `kind` on a `LineToken`, a `LineTokenKind` of `comment`, `string` or `regex`. The Shiki tokenizer does, and a semantic token with `within` applies only over tokens of that kind. [`@adecore/editor-react`](/editor-react/hover#semantic-tokens-inlay-hints-and-folds) decodes a language server's semantic tokens into these.
