# Options and keymaps

<Demo src="editor/options" />

## Mount options

`engine.mount(element, options)` takes `EditorOptions`. Most options have a setter that changes them without a remount.

| Option           | Default              | Setter           | Meaning                                                                                                                                                                                                            |
| ---------------- | -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `text`           | required             | `setText`        | The document                                                                                                                                                                                                       |
| `theme`          | required             | `setTheme`       | The syntax theme id, handed to the tokenizer                                                                                                                                                                       |
| `language`       | plain text           |                  | The language id, for the tokenizer and the editing commands                                                                                                                                                        |
| `path`           |                      |                  | The file's path or name, for a language service to read a dialect off                                                                                                                                              |
| `handBack`       | `[]`                 |                  | Extra host chords for this mount, combined with the engine shortcuts                                                                                                                                               |
| `readOnly`       | `false`              | `setReadOnly`    | With `readOnlyReason`, what a person is told when typing into it                                                                                                                                                   |
| `wrap`           | `false`              | `setWrap`        | Wrap long lines                                                                                                                                                                                                    |
| `indentation`    | 4, spaces            | `setIndentation` | `{ tabSize, insertSpaces }`                                                                                                                                                                                        |
| `smartKeys`      | `DEFAULT_SMART_KEYS` | `setSmartKeys`   | What happens as a person types; see below                                                                                                                                                                          |
| `guides`         | `true`               | `setGuides`      | A line at each indentation level                                                                                                                                                                                   |
| `stickyScroll`   | `true`               | `setStickyScroll` | Keep the headers of the blocks scrolled out of sight pinned on top                                                                                                                                                 |
| `whitespace`     | `false`              | `setWhitespace`  | Spaces as dots and tabs as arrows                                                                                                                                                                                  |
| `rightMargin`    | none                 | `setRightMargin` | A column to draw a line at; `null` removes it                                                                                                                                                                      |
| `foldOutline`    | `'hover'`            | `setFoldOutline` | When the fold arrows show in the gutter: `'off'`, `'hover'` or `'always'`                                                                                                                                          |
| `messages`       | none                 |                  | `{ noMoreOccurrences, fold, unfold }`: the first is said when select next occurrence finds no more (without it the editor says nothing); the others name the fold controls with `{start}` and `{end}` placeholders |
| `label`          | `Code editor`        | `setLabel`       | The accessible name of the editor, such as `Commit message`, in the app's language                                                                                                                                 |
| `folds`          |                      |                  | Folds kept from the last time; see [folding](/editor/find-folding#folding)                                                                                                                                         |
| `foldDefaults`   |                      |                  | Fold roles to collapse when a file opens without kept folds                                                                                                                                                        |
| `line`, `column` |                      |                  | One-based, where the caret starts                                                                                                                                                                                  |
| `scrollTop`      |                      |                  | In pixels, where the view starts; without it the caret's line is in view                                                                                                                                           |
| `todoWords`      | `DEFAULT_TODO_WORDS` | `setTodoWords`   | The words that mark a TODO comment; see below                                                                                                                                                                      |
| `fontSize`       | the page's           | `setFontSize`    | In pixels, a zoomed size the host kept; see [zoom](#zoom)                                                                                                                                                          |
| `zoom`           | 12 to 90, wheel on   |                  | `EditorZoom`: `{ min, max, wheel }`, the zoom range and whether the wheel zooms                                                                                                                                   |
| `folding`        | `true`               |                  | `false` disables all folding, for a projected document whose rows must stay visible. `foldOutline: 'off'` only hides the arrows                                                                                   |

`setReadOnly` blocks typing, commands and `applyEdits`. `setText` still works, for a reload from disk.

## TODO comments

A comment containing one of the `todoWords` (`TODO` and `FIXME` by default, whole words in any case) is drawn in `--editor-todo` italics from the word to the end of the comment's line, with a tick in the scroll track. Words in strings or code do not count. An empty list turns it off. `findTodos(text, language, options?)` returns the same `TodoMatch`es for a host that lists them.

## Zoom

`runCommand('increaseFontSize')` and `runCommand('decreaseFontSize')` change the code size by one pixel, and `runCommand('resetFontSize')` returns to the page's `--code-font-size`. Ctrl or Cmd with the wheel, or a pinch, does the same unless `zoom.wheel` is `false`. The size stays in whole pixels between `zoom.min` and `zoom.max`, never below 12. Line height scales with it.

Each zoom step goes to `onFontSizeChange` with the new size, or `null` after a reset. The host can store it and pass it back as `fontSize`, or apply it to other editors with `setFontSize`, which is not reported. `getFontSize()` returns the current size. The commands have no default chord, since other editors' zoom chords are fold keys here.

`refreshFont()` measures the code font again. Call it after changing `--font-mono`, `--code-font-size` or `--code-line-height`, or after a web font loads.

## Smart keys

`EditorSmartKeys` turns each typing behavior of the [model](/editor-core/commands) on or off. All are on except `camelHumps`. `setSmartKeys` takes a partial object.

| Key                  | What it does                                                        |
| -------------------- | ------------------------------------------------------------------- |
| `autoPairBrackets`   | A typed bracket brings its closer, and typing the closer steps over |
| `autoPairQuotes`     | The same for quotes                                                 |
| `surroundSelection`  | A bracket or quote typed over a selection wraps it                  |
| `tabOutOfClosers`    | Tab steps over a closer the editor added                            |
| `smartIndentOnEnter` | Enter indents, continues comments and closes braces                 |
| `indentOnPaste`      | A pasted block takes the indentation of the line it lands on        |
| `smartSemicolon`     | A `;` typed inside a call goes to the end of the statement          |
| `smartArrow`         | In PHP a `-` after a variable, a member, `)` or `]` becomes `->`    |
| `templateLiterals`   | In JavaScript and TypeScript, `${` typed in a quoted string makes it a template literal; one undo restores the quotes |
| `camelHumps`         | Word moves also stop inside `camelCase` and `snake_case` words      |

## Keymaps

`@adecore/editor/keymap` holds one table of every editor and language command, with a chord for macOS and one for other platforms. `Mod` is Cmd on a Mac and Ctrl elsewhere. `Ctrl` and `Meta` are the physical keys. A `null` chord means no key, as for the fold levels, `saveAsLiveTemplate`, `wrapWithAbbreviation` and the AI commands `selectionToChat`, `inlineEdit`, `suggestInline` and `acceptGhostWord`. The template commands follow IntelliJ: `insertLiveTemplate` is `Mod+J`, `surroundWith` is `Mod+Alt+T`, `surroundWithLiveTemplate` is `Mod+Alt+J` and `unwrap` is `Mod+Shift+Delete` (forward delete on a Mac). See the [breaking change](/editor/reference#breaking-wrap-with-abbreviation-has-no-default-chord) for `wrapWithAbbreviation`.

Resolve the table once with the app's overrides, and pass the same table to the engine, to [`ProjectLanguage`](/editor-react/project) and to menus that print keys:

```ts
import { chordOf, parseChord, resolveKeymap } from '@adecore/editor/keymap';

const keymap = resolveKeymap({
    duplicateLine: { mac: 'Mod+Shift+D', other: 'Ctrl+Shift+D' },
    goToSymbol: { mac: null, other: null }
});

const engine = createSmartEditorEngine({
    tokenizer,
    keymap,
    apple,
    handBack: [parseChord('Mod+Shift+P')]
});

chordOf('duplicateLine', apple, keymap); // 'Mod+Shift+D'
```

`resolveKeymap` fills every id the overrides leave out from `KEYMAP`. `parseChord` throws on a chord it cannot read, so validate stored chords first. A `KeyBinding` may carry `takenMac` or `takenOther` (`{ platform, by }`) to record that a platform also uses the chord. The editor ignores it.

Two hooks let the app take keys:

- `handBack` chords pass through the editor untouched, so the app's global shortcuts work while the editor has focus.
- `editor.onKeyDown(handler)` sees every other key first. Returning `true` takes the key; the editor prevents its default and ignores it.

A key table id is not always a command name: `collapse` runs the view command `collapseRegion`. To run a command from a menu, pass an `EditorRunCommand` to `runCommand`; see [Text and events](/editor/editing#commands).
