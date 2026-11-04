# UI

`@adecore/ui` is a set of React components for desktop-style apps: dense toolbars, menus with shortcuts, stacked dialogs, toasts, trees, a settings dialog, and the formatters for every number and date a person reads. Every component draws from one theme of tokens, in light and dark. It builds on React 19, [Base UI](https://base-ui.com), [Lucide](https://lucide.dev) and Tailwind 4.

## What it does

- Menus, dialogs, popovers, selects and tooltips are Base UI parts with the library's look, so focus, arrow keys, typeahead and Escape work.
- Every color is a semantic token with a light and a dark value. The theme removes Tailwind's palette, so a component can only reach the theme.
- One shortcut value matches a key event and prints the shortcut, as ⌘K on a Mac and Ctrl+K elsewhere. With [`ShortcutHints`](/ui/display/shortcut-hints) mounted, holding the modifier shows the key of every visible button.
- The [formatters](/ui/formatting/) follow the language and the region a person picked, separately.
- The [settings dialog](/ui/settings/settings-dialog) puts sections on the left and a pane on the right, with search that jumps to a row and parts for rows, cards and master-detail panes.
- The library's words live in a `ui` namespace that [`UIProvider`](/ui/utilities/ui-provider) adds to the app's i18next, in English and Dutch.

## What it leaves to the app

The theme ships a neutral blue accent, and the app sets its own. The app switches light and dark with `data-theme` on `<html>`. The app owns its i18next instance and its languages, and hands the formatters the language and region through a format source. Routing, data, persistence and the commands behind a menu item stay in the app; the components only report what a person did.

## Entry points

| Entry point | What it holds |
| --- | --- |
| `@adecore/ui` | The components, hooks and helpers. |
| `@adecore/ui/settings` | The [settings dialog](/ui/settings/settings-dialog) and the parts of a pane. |
| `@adecore/ui/format` | The [formatters](/ui/formatting/) for numbers, dates and durations. |
| `@adecore/ui/testing` | [Fakes](/ui/utilities/testing) for your own tests, and `/testing/dedupe`, a `bun test` preload. |
| `@adecore/ui/theme.css` | The [theme](/ui/guide/theme). |

## Where to next

- [Getting started](/ui/guide/getting-started) installs the library, imports the theme and mounts `UIProvider`.
- [Principles](/ui/guide/principles) explains the rules every component follows, and [Theme](/ui/guide/theme) lists every token.
- The component pages, from [Button](/ui/actions/button) to [Workspace](/ui/layout/workspace), each show a demo and the props.
- [Foundations](/ui/utilities/ui-provider) covers the provider, shortcuts, the clipboard and floating layers.
- [Formatting](/ui/formatting/) explains the format source and every formatter.
- [Testing](/ui/utilities/testing) covers the fakes and a linked checkout under `bun test`.
- [Reference](/ui/reference) lists every export of every entry point.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/ui/LICENSE).
