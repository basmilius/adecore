# @adecore/ui

Components for desktop-grade React apps: menus, dialogs, tooltips, fields, toasts, a settings dialog, keyboard shortcuts and formatters, drawn from one theme. Built on React 19, [Base UI](https://base-ui.com), [Lucide](https://lucide.dev) and Tailwind 4.

```sh
bun add @adecore/ui
```

[Getting started](/ui/guide/getting-started) wires it into an app. [Principles](/ui/guide/principles) explains the rules every component follows.

## What it gives you

### Base UI underneath

Menus, dialogs, popovers, selects and tooltips are Base UI parts with the library's look on them, so focus, arrow keys, typeahead and Escape already work.

### One theme of tokens

Every color is a semantic token with a light and a dark value. Tailwind's palette is gone, so a component can only reach the theme. Your app sets its own accent.

### Shortcuts written once

One value decides whether a key event is the shortcut and how it prints, as ⌘K on a Mac and Ctrl+K elsewhere. Hold the modifier and every visible button shows its key.

### Formatters that respect the region

Numbers, dates and durations follow the language a person reads and the region they picked, separately. English words in a Dutch notation is a pair people set.

### A settings dialog

Sections on the left, a pane on the right, search that jumps to a row, and parts for rows, cards and master-detail panes.

### English and Dutch

The library's own words live in a ui namespace you add to your i18next. English is the source, Dutch has every key.
