# @adecore/ui

Components for desktop-grade React apps: menus, dialogs, tooltips, fields, toasts, a settings dialog, keyboard shortcuts and formatters, drawn from one theme. Built on React 19, [Base UI](https://base-ui.com), [Lucide](https://lucide.dev) and Tailwind 4.

```sh
bun add @adecore/ui
```

[Getting started](/ui/guide/getting-started) wires it into an app. [Principles](/ui/guide/principles) explains the rules every component follows.

| Entry point | What it holds |
| --- | --- |
| `@adecore/ui` | The components, hooks and helpers. |
| `@adecore/ui/settings` | The [settings dialog](/ui/settings/settings-dialog) and the parts of a pane. |
| `@adecore/ui/format` | The [formatters](/ui/formatting/) for numbers, dates and durations. |
| `@adecore/ui/testing` | [Fakes](/ui/utilities/testing) for your own tests, and `/testing/dedupe`, a `bun test` preload. |
| `@adecore/ui/theme.css` | The [theme](/ui/guide/theme). |

## What it gives you

### Base UI underneath

Menus, dialogs, popovers, selects and tooltips are Base UI parts with the library's look, so focus, arrow keys, typeahead and Escape work.

### One theme of tokens

Every color is a semantic token with a light and a dark value. Tailwind's palette is gone, so a component can only reach the theme. Your app sets its own accent.

### Shortcuts written once

One value matches a key event and prints the shortcut, as ⌘K on a Mac and Ctrl+K elsewhere. With [`ShortcutHints`](/ui/display/shortcut-hints) mounted, holding the modifier shows every visible button's key.

### Formatters that respect the region

Numbers, dates and durations follow the language and the region a person picked, separately.

### A settings dialog

Sections on the left, a pane on the right, search that jumps to a row, and parts for rows, cards and master-detail panes.

### English and Dutch

The library's words live in a `ui` namespace that [`UIProvider`](/ui/utilities/ui-provider) adds to your i18next, in English and Dutch.
