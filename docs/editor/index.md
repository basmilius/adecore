# Editor

`@adecore/editor` is a code editor for the DOM. It draws a [`DocumentModel`](/editor-core/) and takes keys, mouse, touch, clipboard and input methods through one hidden textarea. It knows no language server. The host hands it problem markers, hints, colors and rows. [`@adecore/editor-react`](/editor-react/) does that for a language service.

```ts
import { createSmartEditorEngine, shikiTokenizers } from '@adecore/editor';

const engine = createSmartEditorEngine({ tokenizer: shikiTokenizers(getHighlighter) });
const editor = engine.mount(element, { text, language: 'typescript', theme: 'github-light' });
```

<Demo src="editor/editor" fill />

The demos color TypeScript with a small tokenizer instead of Shiki; see [Theme and syntax](/editor/theme).

## What it does

- Edits with the commands of the model: multiple carets, smart Enter, bracket pairing, moving statements, column selection.
- Maps every key through one table with a chord per platform, which the app can override and print in its menus.
- Colors code with Shiki or a tokenizer of the app's own, and layers a language server's semantic colors over it.
- Draws what the host knows: problems, inlay hints, change marks, gutter buttons, line highlights, code vision and agent carets.
- Puts the host's own DOM between lines, after a line or in place of lines, and keeps it there while the text changes.
- Finds and replaces, with regular expressions in a worker, and folds by brackets, indentation and a language server's ranges.
- Draws only the rows in view and colors only the lines near them.

## What it leaves to the app

The editor holds text, not files. Reading, saving, drafts and save permissions stay with the host, and Mod+S only calls the `onSave` listeners. It draws no find bar, context menu, hover card or suggestion list; the app or [`@adecore/editor-react`](/editor-react/) draws those over the positions the editor reports. Which agent wrote a line, which lines Git marks as changed and when to accept a suggestion are the app's to decide.

## Where to next

- [Getting started](/editor/getting-started) installs the package, loads the styles and mounts a first editor.
- [Options and keymaps](/editor/options) covers every mount option with its setter, the smart keys and the key table.
- [Text and events](/editor/editing) covers positions, edits, saving, change events, selections, the clipboard and tracked ranges.
- [Decorations](/editor/decorations) covers problems, inlay hints, highlights, semantic colors, change marks and gutter buttons.
- [Rows and widgets](/editor/rows) covers host DOM between lines, virtual code, line highlights, line actions and code vision.
- [Agents](/editor/agents) covers attribution bars, agent carets and ghost text.
- [Find](/editor/find) covers the find matcher and the search worker.
- [Folding and structure](/editor/folding) covers kept folds, sticky scroll and moving through a file's blocks.
- [Theme and syntax](/editor/theme) covers the CSS tokens, Shiki and a tokenizer of your own.
- [Accessibility and touch](/editor/accessibility) covers what a screen reader hears and what a finger does.
- [Testing](/editor/testing) covers a real editor on a page without a browser, and a fake one.
- [Reference](/editor/reference) lists every export and what changed for an older `Editor` or key table.

## Limits

- No bidirectional layout. The editor draws right-to-left text left to right with `unicode-bidi: bidi-override`, so letters stay in the columns the caret uses.
- The editor draws bidirectional control characters (U+202A to U+202E, U+2066 to U+2069, U+200E, U+200F and U+061C) as a boxed three-column label such as `RLO`. The box is visual only and never enters a line's text, since an override could make code read differently from what it does. The caret steps over it as one character, and the document, copy and cut keep the character. Inlay hints, ghost text and input method composition show `[RLO]`. The labels cannot be turned off.
- [Accessibility](/editor/accessibility) is untested with any screen reader (NVDA, JAWS, VoiceOver, Orca).
- The editor does not color a line longer than 20,000 characters.
- Every edit rebuilds the row list, linear in the line count.
- Documents over 2 million characters skip folding ranges and occurrence marks.
- Regular expression search runs only in the search worker, with a deadline. Without a worker it reports unavailable. Literal search runs on the page and caps at 10,000 matches. Folding and selection expansion scan the whole document on the page. See [the search worker](/editor/find#search-worker).
- Wrapped lines break at spaces, or inside a word that does not fit, and continue at the line's indentation plus two columns.
- Documentation comments are plain text unless the host renders them with [`setReplacements`](/editor/rows#replacing-lines), as [`@adecore/editor-react`](/editor-react/rendered-documentation) does. The editor draws no find marks or selections inside a replaced row.

The package is FSL-1.1-MIT.
