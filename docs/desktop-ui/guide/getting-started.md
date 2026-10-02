# Getting started

`@basmilius/desktop-ui` is a set of React components for apps that behave like desktop software: dense toolbars, menus with shortcuts, dialogs over dialogs, a settings window. It sits on [Base UI](https://base-ui.com) for behavior, [Lucide](https://lucide.dev) for icons and Tailwind 4 for styling, and it ships its own theme.

Coming from an earlier package? [MIGRATION.md](https://github.com/basmilius/desktop/blob/main/packages/desktop-ui/MIGRATION.md) maps every old name onto this one.

## Install

::: code-group

```sh [bun]
bun add @basmilius/desktop-ui
```

```sh [npm]
npm install @basmilius/desktop-ui
```

```sh [pnpm]
pnpm add @basmilius/desktop-ui
```

:::

React 19, `react-dom`, `i18next` and `react-i18next` are peer dependencies, so your app brings them. Base UI, Lucide, `clsx`, `zustand` and the file icon set come along with the library.

## Import the theme

Import the theme right after Tailwind, then tell Tailwind to scan the library for the classes its components use:

```css
@import "tailwindcss";
@import "@basmilius/desktop-ui/theme.css";

@source "../node_modules/@basmilius/desktop-ui/dist";
```

The `@source` path is relative to the CSS file it sits in. Without it Tailwind never sees the classes inside the library, and the components render unstyled.

The theme holds the semantic tokens (`bg-surface`, `text-text-muted`, `border-border` and the rest), the type scale and the rules utilities cannot express, such as the states of a menu row. It also resets Tailwind's color palette, so `bg-red-500` stops existing and every color comes from a token. Light and dark follow `data-theme="light"` or `data-theme="dark"` on `<html>`. The [theme page](/desktop-ui/guide/theme) lists every token and shows how to set your own accent.

## Wrap the app in UIProvider

Mount `UIProvider` once, above the first component of the library:

```tsx
import i18next from 'i18next';
import { createRoot } from 'react-dom/client';
import { UIProvider } from '@basmilius/desktop-ui';

createRoot(document.getElementById('root')!).render(
    <UIProvider i18n={i18next} formatSource={formatSource}>
        <App />
    </UIProvider>
);
```

`UIProvider` does four things:

- It adds the library's words to your i18next instance.
- It hands the formatters your `formatSource`.
- It mounts the shared tooltip provider, so moving along a row of buttons shows each tooltip without a new delay.
- It starts noting whether the keyboard or the pointer is in use, as `data-modality` on `<html>`.

Each of these is also exported on its own (`addUiResources`, `setFormatSource`, `TooltipProvider`, `startInputModality`) for an app that wants to wire them itself. See [UIProvider](/desktop-ui/utilities/ui-provider).

## Words and languages

The library's own words, such as "Cancel", "Dismiss" and "Zoom in", live in the `ui` namespace (`UI_NAMESPACE`). English and Dutch ship with it. `UIProvider` adds both to the i18next instance you pass it, next to your own namespaces, and a component reads them through `useTranslation('ui')` on that instance. Switch the language the way you already do, with `i18n.changeLanguage('nl')`.

A language you filled yourself keeps its words, since `addUiResources` skips a language that already has a `ui` bundle. To translate the library into a third language, add a `ui` bundle for it before the provider mounts. `UI_RESOURCES` holds the English source to translate from.

## The format source

The formatters in `@basmilius/desktop-ui/format` write every number, date and duration a person reads. They need two settings: the language, which writes the words (`Sep` or `sep`), and the region, which writes the order, the separators and the clock (`9/19/2026, 8:05 AM` or `19-9-2026 08:05`). The two are separate on purpose. English with a Dutch notation is a common pair on a Dutch computer.

A `FormatSource` hands both over:

```ts
import { FORMAT_LANGUAGE, type FormatSource } from '@basmilius/desktop-ui/format';

const formatSource: FormatSource = {
    language: () => settings.language,
    // A tag such as `nl-NL`, or FORMAT_LANGUAGE to follow the language, or FORMAT_SYSTEM.
    region: () => settings.region ?? FORMAT_LANGUAGE,
    // What a desktop shell reads from the operating system; a browser leaves it out.
    systemLocale: () => desktopShell?.systemLocale,
    subscribe: (onChange) => settings.subscribe(onChange)
};
```

Without one, the formatters write English in the region of that language. [Format source](/desktop-ui/formatting/) explains how the region resolves.

## Optional pieces

Mount `<ShortcutHints />` once if holding Cmd (Ctrl on Windows and Linux) should print every visible button's shortcut under it. Mount `<Toasts store={toasts} />` once for a stack of toasts from `createToastStore()`. Both are opt-in because both listen on the window.

## Working on a local checkout

The package has a `source` export condition that points into `src`. An app can use a checkout of this repository without building it after every change.

Link the checkout:

```sh
# in packages/desktop-ui of the desktop checkout
bun link

# in your app
bun link @basmilius/desktop-ui
```

A `file:../desktop/packages/desktop-ui` dependency works too, but Bun copies the checkout on install, so a change reaches the app only after the next `bun install`.

Turn the condition on in Vite, keep one copy of each shared dependency, and let Vite compile the library's source like your own:

```ts
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        conditions: ['source', ...defaultClientConditions],
        // The checkout has its own node_modules; a second React or i18next breaks every hook and every word.
        dedupe: ['react', 'react-dom', 'i18next', 'react-i18next', '@base-ui-components/react']
    },
    optimizeDeps: {
        exclude: ['@basmilius/desktop-ui'],
        include: ['@base-ui-components/react/menu', '@base-ui-components/react/dialog', 'lucide-react', 'clsx']
    }
});
```

TypeScript needs the same condition, or it looks for types in a `dist` that may not exist:

```json
{
    "compilerOptions": {
        "customConditions": ["source"]
    }
}
```

Your app then type-checks the library's source with its own settings, so it needs `allowImportingTsExtensions`, `resolveJsonModule` and `"jsx": "react-jsx"`.

Point Tailwind at the checkout's `src` instead of `dist`, again relative to the CSS file:

```css
@source "../../desktop/packages/desktop-ui/src";
```

The theme import stays the same. It resolves through the `style` condition, which points at `src/theme.css` in a checkout and in the published package. If Vite refuses to serve files from the checkout, add its folder to `server.fs.allow`.

`bun test` takes the condition as a flag (`bun test --conditions=source`) and has no `dedupe`; the library ships a preload for that, see [Testing](/desktop-ui/utilities/testing#a-linked-checkout-under-bun-test).

These docs use the same condition. Every demo on this site imports `@basmilius/desktop-ui` and draws the source in the repository, not a published build.
