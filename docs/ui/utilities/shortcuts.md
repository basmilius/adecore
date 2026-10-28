# Shortcuts

One shortcut, written once. The same value decides whether a key event is the shortcut and how the shortcut is printed.

```tsx
import { formatShortcut, isApplePlatform, matchesShortcut, shortcut } from '@adecore/ui';

const SAVE = shortcut('Mod+S');
```

<Demo src="utilities/shortcuts" />

## Writing one

`shortcut(text)` parses modifiers and one key joined by `+`. `Mod` is Cmd on macOS and Ctrl elsewhere. `Ctrl` and `Meta` name the physical key, for shortcuts that differ per platform on purpose. `Alt` and `Shift` complete the set.

The key is a letter, a digit, one of ``, . / ; ' ` \ [ ]``, `+`, `-`, `=`, a named key (`Enter`, `Escape`, `Backspace`, `Delete`, `Tab`, `Space` and the four arrows) or `F1` to `F12`. `Mod++` is Mod and the plus key. A modifier alone, such as `shortcut('Mod')`, never matches; it prints a modifier held during a pointer gesture.

`shortcut` throws on an unknown word or on two keys. Define shortcuts at module level, so a typo fails on load.

## Matching

`matchesShortcut(target, event, apple)` is strict: every modifier the shortcut does not name must be up, so Ctrl+K on a Mac is not Cmd+K. Letters, digits and punctuation match on the physical key (`event.code`), so Shift and Option do not change them. `+`, `-` and `=` match on the character, as their keys differ per layout.

`isModHeld(event, apple)` says whether the platform's modifier is down during a pointer gesture, such as a Cmd-click.

`isApplePlatform()` says whether the keyboard is a Mac's, for both matching and printing.

## Printing

`formatShortcut(target, apple)` writes `⌥⇧⌘K` on macOS and `Ctrl+Alt+Shift+K` elsewhere. `shortcutParts(target, apple)` returns the same as separate caps, which [`Keys`](/ui/display/kbd) draws. Named keys get the platform's symbol, such as `↩` for Enter on a Mac.

## Tables

`EDIT_SHORTCUTS` holds the browser's editing shortcuts (`copy`, `cut`, `paste`, `selectAll`), for printing in a menu; the browser handles the keys. `KEY_SHORTCUTS` holds keys printed as a shortcut in a hint: `enter`, `modEnter`, `backspace`, `escape`, `shift` and `rename` (F2).

## Types

A `Shortcut` is `{ mod, ctrl, meta, alt, shift, key }`. `KeyLike` is the `metaKey`, `ctrlKey`, `altKey`, `shiftKey`, `key` and `code` of a `KeyboardEvent`, which a test can write by hand.

Bind each shortcut once, on the window, in one place. A shortcut needs a modifier; see [Principles](/ui/guide/principles#every-shortcut-needs-a-modifier).
