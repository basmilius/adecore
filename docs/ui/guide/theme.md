# Theme

`@adecore/ui/theme.css` holds the tokens every component draws with. Each color token has a light and a dark value, switched by `data-theme="light"` or `data-theme="dark"` on `<html>`. The tables below are read from that file at build time.

The theme maps the tokens onto Tailwind utilities (`bg-surface`, `text-text-muted`, `border-border`, `shadow-float`) and clears Tailwind's default palette with `--color-*: initial`. Components and your app can reach only these colors until you add your own.

## Ground and surfaces

`--bg` is the page. Panels and cards are `--surface`; popups, menus and dialogs float on `--surface-raised`. `--surface-sunken` is the recessed track of a segmented control, or a field without a box. `--track` is what a bar or ring fills, an alpha that holds on any surface. `--surface-hover` is lighter than `--surface-active`, so pressed outranks hover. `--field` is what a person types or picks in, a step lighter than the panel in the dark theme. `--thumb` is the knob of a slider or switch, set apart from its track in both themes.

<TokenTable group="ground" />

## Borders

Alpha over whatever is behind, never a gray of their own (see [Principles](/ui/guide/principles#borders-are-alpha)). `--border-soft` is the hairline between rows, `--border-strong` the outline of a control that has to read as one.

<TokenTable group="border" />

`--separator` is opaque and fills the space between separated panels. To match borders to those gaps, set `--border: var(--separator)` in both theme scopes.

## Text

<TokenTable group="text" />

## Accent

The accent marks the primary button, the focus outline, a picked choice and the text selection. The default is a neutral blue; your app sets its own ([below](#your-own-accent)).

<TokenTable group="accent" />

## Status

Four states something can be in (running, waiting on a person, idle, failed) and a positive fill for a step that went well.

<TokenTable group="status" />

## Shadows

`--float-shadow` lifts everything that floats: menus, dialogs, tooltips, toasts. `--raised-shadow` is the small lift of a picked segment off its track, and `--thumb-shadow` the edge and lift of a thumb.

<TokenTable group="shadow" />

## Media

A control drawn over a picture rather than over the interface, such as the handle of a [`Wipe`](/ui/layout/wipe). It stays the same in both themes.

<TokenTable group="media" />

## Chart series

Chart series colors in order: the accent, then orange, aqua, yellow, magenta and green. The order is checked for color vision deficiency on both grounds. A series without its own tone takes the next one, as in [`@adecore/charts`](/charts/).

<TokenTable group="chart" />

## File icons

The palette [`FileIcon`](/ui/display/file-icon) colors file types with. The theme never tints a file icon, so TypeScript stays blue everywhere.

<TokenTable group="file-icon" />

## Layers

All z-indexes live here, so a new popup never guesses. A dialog sits under the menus and selects it opens, tooltips over both, and the [shortcut hints](/ui/display/shortcut-hints) over everything. Reach a step with `z-(--z-popup)`.

<TokenTable group="layer" />

<TokenTable group="other" />

## Type scale

Sizes are rem, rounded to whole pixels, against the font size your app sets on `<html>`. 15px reads well in a desktop app. Code keeps an absolute size.

`2xs` (12px at a 15px root) is only for a small label in a row of `xs`, such as a [`Pill`](/ui/actions/pill). Nothing goes below it.

<TokenTable group="type" />

<TokenTable group="leading" />

## Radius

<TokenTable group="radius" />

## Code

Code (an editor, a grid of database values, a statement) has one size apart from the type scale. `--code-font-size` and `--code-line-height` default to `--text-code` and its line height. Set them on `<html>`, for example from an editor font setting, and every code view follows. Utilities reach them as `text-(length:--code-font-size)` and `leading-(--code-line-height)`.

<TokenTable group="code" />

## Spacing and fonts

The spacing unit is rounded, so every step lands on a whole pixel. Override `--font-mono` on `<html>` when a person picks a monospace font; `font-mono` follows.

<TokenTable group="spacing" />

<TokenTable group="font" />

## Your own accent

Set the accent after the theme import, in both forms. `--accent-rgb` is the same color as channels, for tokens that add an alpha, such as the text selection.

```css
@import "tailwindcss";
@import "@adecore/ui/theme.css";

:root {
    --accent: #7c3aed;
    --accent-rgb: 124 58 237;
}
```

`--accent-soft` follows by itself. Set `--accent-text` if white does not read on your accent. For a separate dark accent, repeat the rule under `[data-theme="dark"]`.

## Your own colors

Add a token in both themes and map it onto a Tailwind color:

```css
:root, [data-theme="light"] {
    --brand: #0f766e;
}

[data-theme="dark"] {
    --brand: #2dd4bf;
}

@theme inline {
    --color-brand: var(--brand);
}
```

Now `bg-brand`, `text-brand` and `border-brand/40` exist. `inline` makes the utility follow `data-theme`. A token derived with `var()` resolves where it is declared, so declare it in the same rule as the tokens it reads.

## Rules the utilities cannot write

A few classes cover what a utility cannot express: Base UI state attributes, pseudo-elements, keyframes. Use them for something that has to look like a component.

| Class | What it draws |
| --- | --- |
| `.icon-btn`, `.icon-btn-sm`, `.icon-btn-xs`, `.icon-btn-2xs` | The square of an icon button and its pressed and disabled states. |
| `.field`, `.field-sm` | A text field's border, height and focus outline. |
| `.menu-popup`, `.picker-popup`, `.menu-item` | A menu's surface and a row in it, with its highlighted and disabled states. |
| `.cursor-row` | A row of a list the arrow keys walk that is not a Base UI menu, with `data-active="true"` on the current one. |
| `.dialog-popup`, `.dialog-backdrop`, `.lightbox-frame`, `.lightbox-backdrop` | A dialog's surface and dim, and a dialog that shows only a picture. |
| `.tooltip-positioner`, `.tooltip-popup` | A tooltip that fades in from the side of its trigger. |
| `.focus-ring`, `.focus-ring-within` | The keyboard focus outline on something that is not a button, or on a card around a focused field. |
| `.scroll-fade-x`, `.scroll-fade-top` | A fade at an edge that still hides content, switched on by `data-fade-start` and `data-fade-end`. `.scroll-fade-x` takes its width from `--fade-size`. |
| `.file-icon` | A file icon outside the tree: the hue the sprite gives its file type, or the muted text color. |

Every class sits in Tailwind's `components` layer, so a utility on the same element still wins.
