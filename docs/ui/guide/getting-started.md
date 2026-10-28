# Getting started

`@adecore/ui` is a set of React components for desktop-style apps: dense toolbars, menus with shortcuts, stacked dialogs, a settings window. It builds on [Base UI](https://base-ui.com), [Lucide](https://lucide.dev) and Tailwind 4, and ships its own theme.

## Install

::: code-group

```sh [bun]
bun add @adecore/ui
```

```sh [npm]
npm install @adecore/ui
```

```sh [pnpm]
pnpm add @adecore/ui
```

:::

React 19, `react-dom`, `i18next` and `react-i18next` are peer dependencies. Base UI, Lucide, `clsx`, `zustand` and `@pierre/trees` (the file tree engine) come with the library.

## Import the theme

Import the theme after Tailwind, and let Tailwind scan the library's classes:

```css
@import "tailwindcss";
@import "@adecore/ui/theme.css";

@source "../node_modules/@adecore/ui/dist";
```

The `@source` path is relative to the CSS file. Without it the components render unstyled.

The theme resets Tailwind's palette, so `bg-red-500` no longer exists and every color comes from a token. Light and dark follow `data-theme="light"` or `data-theme="dark"` on `<html>`. The [theme page](/ui/guide/theme) lists every token and shows how to set your own accent.

## Wrap the app in UIProvider

Mount `UIProvider` once, above the library's components:

```tsx
import i18next from 'i18next';
import { createRoot } from 'react-dom/client';
import { UIProvider } from '@adecore/ui';

createRoot(document.getElementById('root')!).render(
    <UIProvider i18n={i18next} formatSource={formatSource}>
        <App />
    </UIProvider>
);
```

It adds the library's words to your i18next instance, hands the formatters your `formatSource`, mounts the shared tooltip provider and writes `data-modality` on `<html>`. To wire the format source yourself, call `setFormatSource`. See [UIProvider](/ui/utilities/ui-provider).

## Words and languages

The library's words ("Cancel", "Zoom in") live in the `ui` namespace (`UI_NAMESPACE`), in English and Dutch. `UIProvider` adds both to your i18next instance. Switch languages as usual with `i18n.changeLanguage('nl')`.

`UIProvider` skips a language that already has a `ui` bundle. To add a third language, add its `ui` bundle before the provider mounts. `UI_RESOURCES` holds the English source.

## The format source

The formatters in `@adecore/ui/format` take two settings. The language writes the words (`Sep` or `sep`). The region writes the order, separators and clock (`9/19/2026, 8:05 AM` or `19-9-2026 08:05`). English with a Dutch notation is a common pair.

A `FormatSource` hands both over:

```ts
import { FORMAT_LANGUAGE, type FormatSource } from '@adecore/ui/format';

const formatSource: FormatSource = {
    language: () => settings.language,
    // A tag such as `nl-NL`, or FORMAT_LANGUAGE to follow the language, or FORMAT_SYSTEM.
    region: () => settings.region ?? FORMAT_LANGUAGE,
    // What a desktop shell reads from the operating system; a browser leaves it out.
    systemLocale: () => desktopShell?.systemLocale,
    subscribe: (onChange) => settings.subscribe(onChange)
};
```

Without one, the formatters write English. [Format source](/ui/formatting/) explains how the region resolves.

## Optional pieces

Mount [`<ShortcutHints />`](/ui/display/shortcut-hints) once to print every visible button's shortcut while Cmd (Ctrl elsewhere) is held. Mount [`<Toasts store={toasts} />`](/ui/overlays/toasts) once for toasts from `createToastStore()`.

## Working on a local checkout

The `source` export condition points into `src`, so an app can use a checkout without building it. Link the checkout:

```sh
# in packages/ui of the checkout
bun link

# in your app
bun link @adecore/ui
```

A `file:../adecore/packages/ui` dependency works too, but changes arrive only after the next `bun install`.

In Vite, turn on the condition and dedupe shared dependencies:

```ts
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        conditions: ['source', ...defaultClientConditions],
        // The checkout has its own node_modules; a second React or i18next breaks every hook and every word.
        dedupe: ['react', 'react-dom', 'i18next', 'react-i18next', '@base-ui/react']
    },
    optimizeDeps: {
        exclude: ['@adecore/ui'],
        include: ['@base-ui/react/menu', '@base-ui/react/dialog', 'lucide-react', 'clsx']
    }
});
```

TypeScript needs the same condition:

```json
{
    "compilerOptions": {
        "customConditions": ["source"]
    }
}
```

Your app then type-checks the library's source, so it needs `allowImportingTsExtensions`, `resolveJsonModule` and `"jsx": "react-jsx"`.

Point Tailwind at the checkout's `src`:

```css
@source "../../adecore/packages/ui/src";
```

The theme import stays the same. If Vite refuses to serve files from the checkout, add its folder to `server.fs.allow`.

`bun test` takes the condition as a flag (`bun test --conditions=source`) and has no `dedupe`; see [Testing](/ui/utilities/testing#a-linked-checkout-under-bun-test) for the preload.
