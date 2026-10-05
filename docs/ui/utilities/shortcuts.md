# Shortcuts

One shortcut, written once. The same value decides whether a key event is the shortcut and how the shortcut is printed.

```tsx
import { formatShortcut, isApplePlatform, matchesShortcut, shortcut } from '@adecore/ui';

const SAVE = shortcut('Mod+S');
```

<Demo src="utilities/shortcuts" />

## Writing one

`shortcut(text)` parses modifiers and one key joined by `+`. `Mod` is Cmd on macOS and Ctrl everywhere else, which is what most shortcuts want. `Ctrl` and `Meta` name the physical key, for the few shortcuts that differ per platform on purpose. `Alt` and `Shift` complete the set.

The key is a letter, a digit, one of ``, . / ; ' ` \ [ ]``, `+`, `-`, `=`, a named key (`Enter`, `Escape`, `Backspace`, `Delete`, `Tab`, `Space` and the four arrows) or `F1` to `F12`. `Mod++` is Mod and the plus key. A modifier alone, such as `shortcut('Mod')`, never matches a key; it is for printing a modifier held during a pointer gesture.

`shortcut` throws on a word it does not know or on two keys. Define shortcuts at module level, so a typo fails the moment the module loads instead of leaving a shortcut that never fires.

## Matching

`matchesShortcut(target, event, apple)` is strict. Every modifier the shortcut does not name has to be up, so Ctrl+K on a Mac is not Cmd+K. Letters, digits and the punctuation above match on the physical key (`event.code`), because Shift turns `1` into `!` and Option turns most keys into a dead key on macOS. `+`, `-` and `=` match on the character, because they sit on different keys per layout.

`isModHeld(event, apple)` says whether the platform's modifier is down during a pointer gesture, such as a Cmd-click.

`isApplePlatform()` says whether the keyboard in front of the page is a Mac's, which decides both matching and printing.

## Printing

`formatShortcut(target, apple)` writes `⌥⇧⌘K` on macOS and `Ctrl+Alt+Shift+K` elsewhere, with the modifiers in the order each platform prints them. `shortcutParts(target, apple)` returns the same as separate caps, which [`Keys`](/ui/display/kbd) draws. Named keys get the platform's symbol where it has one, such as `↩` for Enter and `⌫` for Backspace on a Mac.

## Tables

`EDIT_SHORTCUTS` holds the browser's own editing shortcuts (`copy`, `cut`, `paste`, `selectAll`), which an app only prints in a menu; the browser already handles the keys. `KEY_SHORTCUTS` holds keys that are no shortcut of their own but are printed as one in a hint: `enter`, `modEnter`, `backspace`, `escape`, `shift` and `rename` (F2).

## Types

A `Shortcut` is `{ mod, ctrl, meta, alt, shift, key }`. `KeyLike` is what a shortcut matches against: the `metaKey`, `ctrlKey`, `altKey`, `shiftKey`, `key` and `code` of a `KeyboardEvent`, which a test can write by hand.

Bind each shortcut once, on the window, in one place. A shortcut needs a modifier; see [Principles](/ui/guide/principles#every-shortcut-needs-a-modifier).
