# Testing, resources, and provenance

Test the core with ordinary strings and model instances. There is no browser setup or provider process. Capture the revision before async work, assert stale edits leave text unchanged, and verify the history behavior the host relies on.

```ts
import { DocumentModel } from '@adecore/editor-core';

const document = new DocumentModel('one two');
const snapshot = document.getSnapshot();
const events: number[] = [];
const subscription = document.subscribe((next) => events.push(next.revision));

document.applyEdits([{ from: 4, to: 7, text: 'three' }]);
console.assert(snapshot.text === 'one two');
console.assert(document.getText() === 'one three');
document.undo();
console.assert(document.getText() === 'one two');
console.assert(events.join(',') === '1,2');
subscription.dispose();
```

From a local checkout, `bun run --cwd packages/editor-core test` runs the source-conditioned tests. `typecheck` checks the package and `build` writes compiled exports. `benchmark` is an opt-in resource measurement with garbage collection enabled; it is not an acceptance guarantee for every host.

## Resource limits

The persistent rope shares unchanged text with prior states, and history keeps the last 200 steps. There is no document-size cap. A retained model, snapshot, or history step still owns the text it references.

Search, folding, and selection expansion synchronously inspect whole-document text when requested. Use a worker or bound the host's input when accepting untrusted regular expressions; the matcher has no execution timeout. Long single words can make word movement expensive. These limitations remain even when the DOM view renders only visible rows.

The bounded `changedSpans` diff falls back to `changedSpan` past 4 million work steps, 1,000 edited lines, or 16 MiB between its first and last changes. The model's lexical bracket scan skips texts over 2 million code units; pairing lookahead has a 400,000-code-unit scan bound. These bounds protect particular operations, not total editor memory or keystroke time.

Backspace and forward deletion use `Intl.Segmenter` for graphemes. Offsets and protocol columns remain UTF-16. The model avoids surrogate splits in edit boundaries and navigation; that does not provide bidirectional layout.

## Lexical limits

The scanners are not parsers. Ambiguous regex-versus-division syntax, JSX content, Python triple quotes, and HTML/XML tag pairing can exceed their understanding. The structural scanner used for selection expansion and some folds does not model regex literals or template interpolation. PHP markup and heredoc/nowdoc bodies have dedicated lexical modes.

Unknown language ids do not receive an invented comment or brace grammar. Auto-indent is based on lexical code regions and leaves unsupported languages and markup regions alone. Prefer server formatting when the host needs language-specific formatting. Core command behavior is useful on incomplete text, but it does not establish syntax validity.

## Licensing and transferred behavior

The transferred source baseline is revision `9729144f0df3f25628f20cc283dee54f8d9e8162`. Original package code carries FSL-1.1-MIT. The word-boundary predicates are a modified TypeScript adaptation from JetBrains' IntelliJ Platform under Apache 2.0. Preserve `LICENSE`, `NOTICE`, and `LICENSE.apache-2.0.txt` when distributing the package.

The upstream predicates come from `platform/platform-impl/src/com/intellij/openapi/editor/actions/EditorActionUtil.java`, revision `7184b03af6c5370e79a01ded0df68cf56d7669da`, lines 934 through 982. Their branch order and underscore, dollar, acronym, and start/end rules are retained. Runtime Unicode classification can differ from the Java version.

The rope, transaction/history implementation, commands, search, folding, and scanners are original implementation. Matching an editor's documented behavior does not make this its runtime or its parser. The package bundles neither Monaco nor CodeMirror nor IntelliJ. Read the [package README and provenance](https://github.com/basmilius/adecore/blob/main/packages/editor-core/README.md) and [NOTICE](https://github.com/basmilius/adecore/blob/main/packages/editor-core/NOTICE) before redistribution.
