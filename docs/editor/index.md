# @adecore/editor

A code editor for the DOM. It draws a [`DocumentModel`](/editor-core/) with a layout of its own, renders only the rows in view, and takes keys, the mouse, the clipboard and input methods through one hidden textarea. It knows no language server: a host hands it markers, hints, colors and rows of its own, and [`@adecore/editor-react`](/editor-react/) does that for an LSP language service.

```ts
import { createSmartEditorEngine } from '@adecore/editor';

const engine = createSmartEditorEngine({ tokenizer: shikiTokenizers(getHighlighter) });
const editor = engine.mount(element, { text, language: 'typescript', theme: 'github-light' });
```

<Demo src="editor/editor" fill />

The demos on these pages color TypeScript with a small tokenizer of their own instead of Shiki; see [Theme and syntax](/editor/theme).

## What is in it

- [Getting started](/editor/getting-started): install, the styles, mounting, the engine options and tearing down.
- [Options and keymaps](/editor/options): every mount option with its setter, the smart keys, and one key table for the editor, menus and hints.
- [Text and events](/editor/editing): positions, replacing text, edits as one undo step, selections, change events and tracked ranges.
- [Decorations](/editor/decorations): problem markers, inlay hints, highlights, semantic colors, change marks and gutter buttons.
- [Rows and widgets](/editor/rows): rows of the host's own DOM between lines, code that is not in the document, line highlights, line actions and code vision.
- [Agents](/editor/agents): attribution bars, the carets of agents and ghost text.
- [Find and folding](/editor/find-folding): the matcher behind a find bar, folds that persist and the blocks of sticky scroll.
- [Theme and syntax](/editor/theme): CSS tokens, Shiki and a tokenizer of your own.
- [Testing](/editor/testing): a real editor on a page without a browser, and a fake one.

## Entry points

| Import                       | What it holds                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `@adecore/editor`            | `createSmartEditorEngine`, the `Editor` contract and its types, `DEFAULT_SMART_KEYS`, `AGENT_COLORS`, `shikiTokenizers`, `shikiScopeColors` |
| `@adecore/editor/editor.css` | The styles of the editor                                                         |
| `@adecore/editor/shiki`      | The Shiki adapters plus `loadGrammar` and `documentLanguageOf`                   |
| `@adecore/editor/keymap`     | `KEYMAP`, `KEYMAP_IDS`, `resolveKeymap`, `chordOf`, `parseChord`                 |
| `@adecore/editor/fake`       | `FakeEditor` and `FakeEditorEngine`, for tests of host code                      |
| `@adecore/editor/testing`    | `mountEditor` and the helpers behind it, on a LinkeDOM page                      |

## Limits

- The editor has no bidirectional text layout. Right-to-left text is drawn left to right.
- The textarea carries the text around the caret and an `aria-label` of `Code editor` for assistive technology. Nothing has been tested with a screen reader beyond that, and the label cannot be changed through the options.
- A line longer than 20,000 characters is not colored.
- Every edit rebuilds the list of rows, which is linear in the number of lines.
- Folding ranges and the marks of a selection's other occurrences are skipped in a document over 2 million characters.
- Search and folding read the whole document synchronously, and a regular expression has no time limit; see the [limits of the model](/editor-core/#limits).
- Wrapped lines break at spaces, or inside a word that does not fit, and continue at the line's indentation plus two columns.
- Documentation comments are drawn as text, not rendered.

The package is FSL-1.1-MIT.
