# @adecore/editor

A code editor for the DOM. It draws a [`DocumentModel`](/editor-core/), renders only the rows in view, and takes keys, mouse, clipboard and input methods through one hidden textarea. It knows no language server. The host hands it markers, hints, colors and rows, and [`@adecore/editor-react`](/editor-react/) does that for an LSP language service.

```ts
import { createSmartEditorEngine } from '@adecore/editor';

const engine = createSmartEditorEngine({ tokenizer: shikiTokenizers(getHighlighter) });
const editor = engine.mount(element, { text, language: 'typescript', theme: 'github-light' });
```

<Demo src="editor/editor" fill />

The demos color TypeScript with a small tokenizer instead of Shiki; see [Theme and syntax](/editor/theme).

## What is in it

- [Getting started](/editor/getting-started): install, styles, mounting, engine options and teardown.
- [Options and keymaps](/editor/options): every mount option with its setter, the smart keys and the key table.
- [Text and events](/editor/editing): positions, replacing text, undo steps, selections, change events and tracked ranges.
- [Decorations](/editor/decorations): problem markers, inlay hints, highlights, semantic colors, change marks and gutter buttons.
- [Rows and widgets](/editor/rows): host DOM between lines, virtual code, line highlights, line actions and code vision.
- [Agents](/editor/agents): attribution bars, agent carets and ghost text.
- [Find and folding](/editor/find-folding): the find matcher, persistent folds and sticky scroll.
- [Theme and syntax](/editor/theme): CSS tokens, Shiki and a tokenizer of your own.
- [Testing](/editor/testing): a real editor on a page without a browser, and a fake one.

## Entry points

| Import                       | What it holds                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `@adecore/editor`            | `createSmartEditorEngine`, the `Editor` contract and its types, `DEFAULT_SMART_KEYS`, `AGENT_COLORS`, `shikiTokenizers`, `shikiScopeColors` |
| `@adecore/editor/editor.css` | The styles of the editor                                                                                                                    |
| `@adecore/editor/shiki`      | The Shiki adapters plus `loadGrammar` and `documentLanguageOf`                                                                              |
| `@adecore/editor/keymap`     | `KEYMAP`, `KEYMAP_IDS`, `resolveKeymap`, `chordOf`, `parseChord`                                                                            |
| `@adecore/editor/fake`       | `FakeEditor` and `FakeEditorEngine`, for tests of host code                                                                                 |
| `@adecore/editor/testing`    | `mountEditor` and the helpers behind it, on a LinkeDOM page                                                                                 |

## Accessibility

Assistive technology reads the hidden textarea, and the keyboard types into it. It holds the text around the caret, mirrors the selection and describes the caret's line and column. On top of that:

- `aria-label` comes from the `label` option, and `aria-multiline` is set.
- `setInputPopup({ controls, activeDescendant })` points the textarea at a list beside the text, such as suggestions. It sets `aria-expanded="true"`, `aria-autocomplete="list"`, `aria-controls` and `aria-activedescendant`, and focus stays in the text. `null` removes all four. The role stays `textbox`, which does not allow `aria-expanded`, so a checker may flag it.
- `announce(message)` speaks a sentence through a hidden polite live region. It draws nothing. A sentence repeated is heard twice.
- `setLineLabels(labels)` gives a zero-based line a hidden sentence in its gutter, such as `Added, new line 12`. A labeled line hides its drawn number and sign from assistive technology, so the sentence must include the number.
- The gutter fold controls are buttons with `aria-expanded` and names like `Fold lines 3 to 9`. `messages.fold` and `messages.unfold` take `{start}` and `{end}` placeholders, and `setMessages` changes them later. The controls are outside the tab order (`tabindex="-1"`). Keyboard users fold through the [fold commands](/editor/find-folding#folding).

No screen reader has tested any of this. The attributes are checked in LinkeDOM tests only.

## Touch

Touch works without setup:

- Dragging scrolls natively (`touch-action: pan-x pan-y pinch-zoom`), with pinch zoom but no double-tap zoom. A drag never selects.
- A tap places the caret and opens the on-screen keyboard. A tap on a line number selects the line.
- A double tap selects the word. A half-second hold selects the word under the finger and then fires `onContextMenu`.
- The textarea asks for plain text: no capitalization, correction or spell checking, `inputmode="text"` and `enterkeyhint="enter"`.
- When the on-screen keyboard resizes the visual viewport, the caret scrolls back into view. This needs `window.visualViewport`.

A pen behaves like a mouse. There are no selection handles. Touch was tested with synthesized events in LinkeDOM only, never on a real device.

## Limits

- No bidirectional layout. Right-to-left text is drawn left to right with `unicode-bidi: bidi-override`, so letters stay in the columns the caret uses.
- Bidirectional control characters (U+202A to U+202E, U+2066 to U+2069, U+200E, U+200F and U+061C) are drawn as a boxed three-column label such as `RLO`. The box is visual only and never enters a line's text, since an override could make code read differently from what it does. The caret steps over it as one character, and the document, copy and cut keep the character. Inlay hints, ghost text and input method composition show `[RLO]`. The labels cannot be turned off.
- [Accessibility](#accessibility) is untested with any screen reader (NVDA, JAWS, VoiceOver, Orca).
- A line longer than 20,000 characters is not colored.
- Every edit rebuilds the row list, linear in the line count.
- Documents over 2 million characters skip folding ranges and occurrence marks.
- Regular expression search runs only in the search worker, with a deadline. Without a worker it reports unavailable. Literal search runs on the page and caps at 10,000 matches. Folding and selection expansion scan the whole document on the page. See [find and folding](/editor/find-folding#search-worker).
- Wrapped lines break at spaces, or inside a word that does not fit, and continue at the line's indentation plus two columns.
- Documentation comments are plain text unless the host renders them with [`setReplacements`](/editor/rows#replacing-lines), as [`@adecore/editor-react`](/editor-react/rendered-documentation) does. Find marks and selections inside a replaced row are not drawn.

The package is FSL-1.1-MIT.
