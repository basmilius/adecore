# Configuration and keymaps

`createSmartEditorEngine(options)` returns an `EditorEngine`. Share an engine across mounts when they use the same tokenizer, scope colors, platform interpretation, and keymap. Each mounted editor owns its document, history, view, subscriptions, and decorations.

## Engine options

| `SmartEditorEngineOptions` | Default / responsibility                                                |
| -------------------------- | ----------------------------------------------------------------------- |
| `tokenizer`                | Required async `TokenizerSource`; return `null` for plain text          |
| `scopeColors`              | Optional theme-to-scope mapping; semantic colors are ignored without it |
| `keymap`                   | Package `KEYMAP` when omitted                                           |
| `handBack`                 | Empty; chords the editor leaves for the host                            |
| `apple`                    | `false`; set for macOS key interpretation                               |

An async tokenizer answer is ignored if a newer theme request has superseded it or the editor has been disposed. Loading failures fall back to plain text. There is no mount promise to await. The editor can accept input while grammar loading finishes.

## Mount options and updates

`EditorOptions.text` and `theme` are required. `language` is the syntax-language id; an omitted or unsupported grammar draws plain text. `path` carries the file name or path for a consumer's dialect decisions. The editor does not read that path from disk.

| Option                       | Default                 | Live setter                     |
| ---------------------------- | ----------------------- | ------------------------------- |
| `readOnly`, `readOnlyReason` | `false`, absent         | `setReadOnly`                   |
| `wrap`                       | `false`                 | `setWrap`                       |
| `indentation`                | Tab width 4, spaces     | `setIndentation`                |
| `smartKeys`                  | `DEFAULT_SMART_KEYS`    | `setSmartKeys`                  |
| `guides`                     | `true`                  | `setGuides`                     |
| `whitespace`                 | `false`                 | `setWhitespace`                 |
| `rightMargin`                | None                    | `setRightMargin`, `null` clears |
| `foldOutline`                | `hover`                 | `setFoldOutline`                |
| `messages`                   | Host overrides optional | Mount configuration             |
| `theme`                      | Required Shiki theme id | `setTheme`                      |
| `text`                       | Required initial text   | `setText`                       |

`EditorSmartKeys` enables bracket/quote pairing, selection wrapping, Tab out of inserted closers, smart indentation on Enter, indentation on paste, and smart semicolons by default. `camelHumps` defaults to `false`. A partial `setSmartKeys` update preserves the unspecified current values. The current `EditorMessages` contract contains `noMoreOccurrences`; supply it in the host's language.

`line` and `column` on mount are one-based. `scrollTop` is pixels. Without a remembered scroll position, an opening line is revealed. `folds` restores previously collected `EditorFolds`; `foldDefaults` lists roles to collapse when no remembered folds exist. Live text positions use zero-based lines and characters. See [fold behavior](./search-widgets#folding).

There is no general extension registry or plugin loader. Extend behavior through the public events, handlers, decoration setters, widget owners, and an injected `LanguageService`. Keep the host extension's lifetime tied to its editor.

## Resolve one key table

```ts
import { createSmartEditorEngine } from '@adecore/editor';
import { chordOf, parseChord, resolveKeymap } from '@adecore/editor/keymap';

const apple = true;
const keymap = resolveKeymap({
    duplicateLine: { mac: 'Mod+Shift+D', other: 'Ctrl+Shift+D' },
    goToSymbol: { mac: null, other: null }
});
export const engine = createSmartEditorEngine({
    tokenizer: async () => null,
    keymap,
    apple,
    handBack: [parseChord('Mod+Shift+P')]
});
const duplicateHint = chordOf('duplicateLine', apple, keymap);
console.assert(duplicateHint === 'Mod+Shift+D');
```

Pass this same resolved `Keymap` to the engine, language host, menus, command palette, and shortcut hints. `resolveKeymap` merges partial `KeymapOverrides` into every `KEYMAP_IDS` entry. `chordOf` returns the platform chord or `null`. `parseChord` throws for malformed chords; validate stored host overrides before using them.

`Mod` means Cmd on macOS and Ctrl elsewhere. `Ctrl` and `Meta` name physical keys. `KeyBinding` can carry `takenMac` / `takenOther` metadata naming a host command that owns a collision; the host supplies its own collision policy. `null` means the table has no single-stroke chord. It does not remove the underlying command. Some folding levels are menu commands, and caret cloning has a modifier gesture instead of a printable chord.

`handBack` chords pass through without the editor preventing their default. `onKeyDown` handlers see other keys before built-in editing; the first handler returning `true` takes the key and prevents its default. Remove the handler with the returned function. A key-table id is not always a `runCommand` name: for example `collapse` binds the editor's `collapseRegion` view command. Call the actual `EditorRunCommand` from a menu.
