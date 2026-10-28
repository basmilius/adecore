# Principles

The design rules the library holds itself to. Its test suite checks most of them on every source file. Code built on the library fits in when it keeps them too.

## Type

Interface text comes in four sizes: `text-xs`, `text-sm`, `text-base` and `text-lg`. Most of the interface is `xs`, and the steps above it are small. The scale also has `text-4xl` for a large figure and `text-code`, a fixed 13px that matches a terminal.

No size in brackets (`text-[13px]`) and nothing below 12px. Every size is a `rem` rounded to a whole pixel, so text scales with the layout when an app changes the root font size. Labels are sentence case, never `uppercase`.

## Hints are tooltips

A hint is a [`Tooltip`](/ui/overlays/tooltip), never a `title` attribute. A `title` shows late, in the system's style, never on keyboard focus, and cannot carry a shortcut. A `Tooltip` opens on hover and focus, shares one delay across the app, and prints its shortcut the platform's way.

[`IconButton`](/ui/actions/icon-button) takes a `label` that is both its accessible name and its tooltip, so the two never differ.

## Borders are alpha

A border is black or white at a low alpha (`--border`, `--border-strong`, `--border-soft`), never a gray of its own. A gray line over a tinted surface reads as a smudge; an alpha line takes the color of what it crosses.

For that, every surface clips its background to the padding box. The theme's base layer sets `background-clip: padding-box` on every element. A utility such as `bg-clip-text` still wins.

## Whole pixels

Lengths land on whole pixels. The theme rounds every `rem` and `em` with `round(..., 1px)`, the spacing unit included. Line heights are rounded too. Nothing in the library writes a fractional pixel.

## Icons are 12, 14, 16 or 20

An icon is 12, 14, 16 or 20 pixels, nothing between. [`Icon`](/ui/display/icon) draws Lucide glyphs at a stroke of 1.75, so a small glyph does not outweigh the words beside it.

An icon button picks its icon size from its own size: 16 in the default 32 pixel square, 14 in 28, and 12 in 24 and 20. It never takes a height, width or radius from a class. The size is a prop.

## Every shortcut needs a modifier

A shortcut is Cmd or Ctrl plus a key, never a bare letter. A bare key belongs to whatever has focus: a text field, a terminal, a canvas tool. Write a shortcut once with [`shortcut('Mod+K')`](/ui/utilities/shortcuts). `Mod` is Cmd on macOS and Ctrl elsewhere, and the same value matches the key event and prints the hint.

The library binds no shortcut on the window. Its window listeners only watch: [`ShortcutHints`](/ui/display/shortcut-hints) for a held modifier, the input modality for the device in use, and a [`DockShell`](/ui/layout/dock-shell) with `autoHide` for the pointer. Bind your app's shortcuts on the window in one place, not per component.

## Keyboard and focus

Everything that acts takes the keyboard. The overlays inherit Base UI's behavior:

- Menus and selects move with the arrow keys, jump with Home and End, and find a row by typing its first letters.
- Enter and Space pick a row, Escape closes, and focus returns to the trigger.
- A dialog traps focus while it is open, and a dialog opened over another stacks over it.
- Radio groups such as [`ChoiceCards`](/ui/inputs/choice-cards) move between choices with the arrows.

Keyboard focus is a 2px accent outline, never a ring or a colored border. Pointer focus stays quiet. `.focus-ring` gives the outline to something focusable that is not a button, such as a list row. `.focus-ring-within` draws it on a card that holds a focused field.

## Input modality

Browsers keep `:focus-visible` on for scripted focus after any keystroke. Since Base UI focuses the menu row under the pointer, the outline would then follow the mouse through every menu.

So the library goes by the last real input. `UIProvider` writes `data-modality="keyboard"` or `data-modality="pointer"` on `<html>`. Under the pointer, a highlighted menu row gets the lighter hover background and no outline. Under the keyboard it gets the stronger pressed background. Style your own lists the same way with `.cursor-row[data-active='true']`.

## Numbers and dates

Only `@adecore/ui/format` builds an `Intl` formatter. Every number, date and duration a person reads goes through it, so it follows their language and region, and long lists reuse formatters. See [Formatting](/ui/formatting/).

## Props follow Base UI

A controlled value is `value` and `onValueChange`, `checked` and `onCheckedChange`, or `open` and `onOpenChange`. Variants and sizes are props, never class strings. Every component that draws an element takes `className` and `ref`. Single-element parts also take Base UI's `render` prop, which swaps the element and merges the props of both:

```tsx
<SectionLabel render={<h3 />}>Recent</SectionLabel>
<ListRow variant="inset" render={<button type="button" onClick={open} />}>Readme</ListRow>
```

A component's utilities and yours never set the same property, because Tailwind does not resolve two utilities by their order in `class`. Where you need a different value, it is a prop.
