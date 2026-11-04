# Theme and font

The terminal takes its colors and its font from CSS tokens, so it follows the page's theme and accent without a prop.

## Colors

The `--term-*` tokens in `terminal.css` set the background, the foreground, a cursor in the accent and the sixteen ANSI colors. The selection is `--selection` of the `ui` theme. The package relies on a few more tokens of that theme: `--accent`, `--font-mono` and the scrollbar tokens.

The terminal rereads the tokens when `data-theme`, `class` or the inline style on `<html>` changes. A switch between light and dark, or a new accent, needs nothing from the app.

## Font

The font is `--term-font`, or `--font-mono` while that is unset. To give terminals another font than code, set `--term-font` on `<html>`:

```css
:root {
    --term-font: 'Berkeley Mono', var(--font-mono);
}
```

`fontSize` (13 by default) and `lineHeight` (1 by default) are props. A change refits the grid and reports it through `onResize`.
