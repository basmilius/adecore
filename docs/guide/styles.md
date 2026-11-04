# Styles

The views use Tailwind 4 on the theme of `@adecore/ui`. An app imports Tailwind, the theme and the stylesheet of each package it uses, in that order, and lets Tailwind scan the packages whose components carry utility classes.

## Per package

| Package | Import after the theme | Scan with `@source` |
|---|---|---|
| UI | `@adecore/ui/theme.css` | `@adecore/ui` |
| Charts | | `@adecore/charts` |
| Terminal | `@xterm/xterm/css/xterm.css`, `@adecore/terminal/terminal.css` | |
| Agent views | `@adecore/agents-react/theme.css`, and `@plugin '@tailwindcss/typography'` | `@adecore/agents-react` |
| Editor | `@adecore/editor/editor.css` | |
| Editor views | `@adecore/editor/editor.css`, `@adecore/editor-react/editor-react.css` | `@adecore/editor-react` |
| Database | | `@adecore/database` |

## An example

An app with agent chats and an editor:

```css
@import 'tailwindcss';
@import '@adecore/ui/theme.css';
@import '@adecore/agents-react/theme.css';
@import '@adecore/editor/editor.css';
@import '@adecore/editor-react/editor-react.css';
@plugin '@tailwindcss/typography';

@source '../node_modules/@adecore/ui/dist';
@source '../node_modules/@adecore/agents-react/dist';
@source '../node_modules/@adecore/editor-react/dist';
```

The `@source` paths are relative to the CSS file. With a linked checkout and the `source` condition, scan `src` instead of `dist`. A package left out of the scan renders unstyled.

The [theme](/ui/guide/theme) lists its tokens and how an app sets its own accent.
