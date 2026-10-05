# @basmilius/desktop-ui

[![npm](https://img.shields.io/npm/v/@basmilius/desktop-ui)](https://www.npmjs.com/package/@basmilius/desktop-ui)
[![Docs](https://img.shields.io/badge/docs-desktop.bas.dev-blue)](https://desktop.bas.dev/desktop-ui/)

React components for apps that behave like desktop software: menus with shortcuts, dialogs over dialogs, tooltips, fields, toasts and a settings dialog. Every number and date goes through formatters that follow the language and the region a person set, and one theme of tokens draws it all. Built on React 19, [Base UI](https://base-ui.com), [Lucide](https://lucide.dev) and Tailwind 4.

**[Documentation with a live demo of every component](https://desktop.bas.dev/desktop-ui/)**

## Install

```sh
bun add @basmilius/desktop-ui
```

React 19, `react-dom`, `i18next` and `react-i18next` are peer dependencies; the app brings them.

## Set up

Import the theme right after Tailwind and let Tailwind scan the library for the classes it uses. The `@source` path is relative to the CSS file.

```css
@import "tailwindcss";
@import "@basmilius/desktop-ui/theme.css";
@source "../node_modules/@basmilius/desktop-ui/dist";
```

Wrap the app in `UIProvider` once, above the first component of the library. It adds the library's words to the app's i18next (English and Dutch ship with it), hands the formatters their [format source](https://desktop.bas.dev/desktop-ui/formatting/) and mounts the tooltip provider.

```tsx
import i18next from 'i18next';
import { UIProvider } from '@basmilius/desktop-ui';

createRoot(root).render(
    <UIProvider i18n={i18next} formatSource={formatSource}>
        <App />
    </UIProvider>
);
```

From there, every component is ready to use:

```tsx
<Menu.Root>
    <IconButton icon={Ellipsis} label="More" render={<Menu.Trigger />} />
    <Menu.Popup align="end">
        <Menu.Item onClick={rename}>
            Rename <Kbd shortcut={KEY_SHORTCUTS.rename} />
        </Menu.Item>
        <Menu.Item onClick={remove}>Remove</Menu.Item>
    </Menu.Popup>
</Menu.Root>
```

[Getting started](https://desktop.bas.dev/desktop-ui/guide/getting-started) covers the rest: the format source, a third language, the optional pieces and how to work on a local checkout.

## Entry points

| Import | What it holds |
|---|---|
| `@basmilius/desktop-ui` | The components, hooks and helpers |
| `@basmilius/desktop-ui/settings` | `SettingsDialog` and the parts of a pane |
| `@basmilius/desktop-ui/format` | Numbers, dates, durations and regions, and `setFormatSource` |
| `@basmilius/desktop-ui/terminal` | `TerminalView`, on xterm.js as an optional peer |
| `@basmilius/desktop-ui/testing` | Fakes for an app's tests, such as `fakeFormatSource()` |
| `@basmilius/desktop-ui/testing/dedupe` | A `bun test` preload for an app that links a checkout |
| `@basmilius/desktop-ui/theme.css` | The theme |

Nothing else is public. No module does work on import, so a bundler keeps only what an app uses.

## Documentation

| Page | What it covers |
|---|---|
| [Getting started](https://desktop.bas.dev/desktop-ui/guide/getting-started) | Install, the theme, `UIProvider`, the format source and a local checkout |
| [Principles](https://desktop.bas.dev/desktop-ui/guide/principles) | The rules every component follows, from the type scale to keyboard focus |
| [Theme](https://desktop.bas.dev/desktop-ui/guide/theme) | Every token in light and dark, and how to set an accent |
| [Components](https://desktop.bas.dev/desktop-ui/actions/button) | A page per component with a live demo, grouped in the sidebar |
| [Formatting](https://desktop.bas.dev/desktop-ui/formatting/) | Numbers, dates, durations and regions |
| [Testing](https://desktop.bas.dev/desktop-ui/utilities/testing) | Fakes for an app's tests and the preload for a linked checkout |

## License

MIT
