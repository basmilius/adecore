# @basmilius/react-ui

React components for desktop-grade apps: menus, dialogs, popovers, tooltips, buttons, fields, toasts, a settings dialog, keyboard shortcuts, formatters for numbers and dates, and a theme to draw them with. Built on React 19, [Base UI](https://base-ui.com), [Lucide](https://lucide.dev) and Tailwind 4.

## Install

```sh
bun add @basmilius/react-ui
```

React 19, `react-dom`, `i18next` and `react-i18next` are peer dependencies. The app brings them.

## Set up

Import the theme right after Tailwind and let Tailwind scan the library for the classes it uses:

```css
@import "tailwindcss";
@import "@basmilius/react-ui/theme.css";
@source "../node_modules/@basmilius/react-ui/dist";
```

The `@source` path is relative to the CSS file. The theme holds the semantic tokens (`bg-surface`, `text-text-muted`, `border-border`, ...), the type scale and the rules for icon buttons, fields, menus, dialogs and tooltips. It resets Tailwind's palette, so every color is a token. Light and dark follow `data-theme="light"` or `data-theme="dark"` on `<html>`. The accent is a neutral blue until the app sets its own, in a rule after the import:

```css
:root {
    --accent: #7c3aed;
    --accent-rgb: 124 58 237;
}
```

Wrap the app in `UIProvider` once, above the first component of the library:

```tsx
import i18next from 'i18next';
import { UIProvider } from '@basmilius/react-ui';

createRoot(root).render(
    <UIProvider i18n={i18next} formatSource={formatSource}>
        <App />
    </UIProvider>
);
```

`UIProvider` adds the library's words to the app's i18next under the `ui` namespace (English and Dutch ship with it), hands the formatters their `formatSource`, mounts the tooltip provider and starts noting whether the keyboard or the pointer is in use (`data-modality` on `<html>`, which keeps a focus ring off a menu row the mouse is on). Each piece is available on its own as well: `addUiResources`, `setFormatSource` from `./format`, `TooltipProvider` and `startInputModality`.

A `formatSource` tells the formatters what a person chose: the language writes the words, the region writes the order, the separators and the clock.

```ts
const formatSource: FormatSource = {
    language: () => settings.language,
    region: () => settings.region, // a tag such as `nl-NL`, or FORMAT_LANGUAGE, or FORMAT_SYSTEM
    systemLocale: () => desktopShell?.systemLocale,
    subscribe: (onChange) => settings.subscribe(onChange)
};
```

Mount `<ShortcutHints />` once if holding Cmd (Ctrl elsewhere) should print every visible button's shortcut under it, and `<Toasts store={toasts} />` for a stack of toasts from `createToastStore()`.

## Entry points

| Import | What is in it |
| --- | --- |
| `@basmilius/react-ui` | The components, hooks and helpers |
| `@basmilius/react-ui/settings` | `SettingsDialog` and the parts of a pane: `SettingsSection`, `SettingsRow`, `MasterDetail`, `DetailHeader`, `ConfirmDialog` |
| `@basmilius/react-ui/format` | Numbers, dates, durations and regions, and `setFormatSource` |
| `@basmilius/react-ui/testing` | Fakes for an app's tests, such as `fakeFormatSource()` |
| `@basmilius/react-ui/theme.css` | The theme |

Nothing else is public. Every module has no side effects on import, so a bundler keeps only what an app uses.

## Components

Compound components follow Base UI's namespaces and props (`open` and `onOpenChange`, `value` and `onValueChange`, `checked` and `onCheckedChange`):

```tsx
<Menu.Root>
    <IconButton icon={Ellipsis} label="More" render={<Menu.Trigger />} />
    <Menu.Popup align="end">
        <Menu.Label>View</Menu.Label>
        <Menu.CheckboxItem checked={wrap} onCheckedChange={setWrap}>
            Wrap lines
        </Menu.CheckboxItem>
        <Menu.Separator />
        <Menu.Item onClick={rename}>
            Rename <Kbd shortcut={KEY_SHORTCUTS.rename} />
        </Menu.Item>
    </Menu.Popup>
</Menu.Root>

<Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Popup size="sm">
        <Dialog.Title>Remove the branch?</Dialog.Title>
        <Dialog.Description className="mt-1">It has two commits nothing else has.</Dialog.Description>
        <Dialog.Footer>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={remove}>Remove</Button>
        </Dialog.Footer>
    </Dialog.Popup>
</Dialog.Root>
```

- `Menu`, `ContextMenu`, `Dialog`, `Popover` and `PreviewCard`. A popup part brings its portal, its positioner and its layer. A dialog that opens while another is up stacks over it by itself.
- `Button`, `IconButton`, `ButtonGroup`, `CloseButton`, `Pill`, `Tile`, `ColorSwatch`, `AccentSwatches`.
- `Field`, `FieldHint`, `FormError`, `Input`, `TextArea`, `Select`, `Switch`, `Segmented`, `Stepper`, `ChoiceCards`, `IconPicker`.
- `Tooltip`, `DisabledReason`, `Kbd`, `Keys`, `KeyCap`, `ShortcutHints`.
- `SectionLabel`, `Surface`, `ListRow`, `PanelHeader`, `Separator`, `Skeleton`, `Icon`, `FileIcon`.
- `EmptyState`, `PanelEmpty`, `ErrorBoundary`, `Banner`, `Toasts`, `PromptDialog`, `TextMenu`.
- `SlidingColumn`, `DockShell`, `ZoomControls`, `Wipe`, `ColumnResizeHandle`.
- Hooks and helpers: `useAsyncAction`, `useColumnResize`, `useContentSize`, `useMeasuredWidth`, `useNow`, `useTickingText`, `lazyNamed`, `lazyDialog`, `prefetcher`, `createToastStore`, `shortcut`, `matchesShortcut`, `copyText`, `messageOf`, `isInFloatingLayer`, `cameThroughPortal`, `selectionWithin`, `selectAllWithin`.

Every component takes `className` and a `ref`. The parts that are a single element also take Base UI's `render` prop, which swaps the element for another one and merges the props of both: `<SectionLabel render={<h3 />}>`, `<ListRow variant="inset" render={<button type="button" />}>`.

## Design rules

The library keeps these, and its tests hold every file to them:

- Type comes in the sizes of the theme's scale. No size in brackets, nothing below 12px.
- A hint is a `Tooltip`, never a `title`.
- Icons are 12, 14, 16 or 20 pixels. An icon button draws the icon of its size: 16 in 32, 14 in 28, 12 below.
- Only `format/` builds an `Intl` formatter, so every number and date follows the language and the region a person set.
- Colors are tokens of the theme. No raw color in a component.
- Lengths land on whole pixels. Every `rem` in the theme is rounded to one.
- Keyboard focus is the accent outline, never a ring.

## Working on a local checkout

An app can use a checkout of this repository without a build per change. The package has a `source` export condition that points at `src`. With a checkout beside the app:

```sh
# in react-ui
bun link
# in the app
bun link @basmilius/react-ui
```

A `file:../react-ui` dependency works too, but Bun copies the checkout when it installs, so a change shows up after the next `bun install` in the app rather than at once. Nothing needs a build either way.

Then turn the condition on in Vite, keep one copy of the shared dependencies, and let Vite compile the source like the app's own:

```ts
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        conditions: ['source', ...defaultClientConditions],
        // The checkout has its own node_modules; a second React or i18next breaks every hook and every word.
        dedupe: ['react', 'react-dom', 'i18next', 'react-i18next', '@base-ui-components/react']
    },
    optimizeDeps: {
        exclude: ['@basmilius/react-ui'],
        include: ['@base-ui-components/react/menu', '@base-ui-components/react/dialog', 'lucide-react', 'clsx']
    }
});
```

TypeScript needs the same condition to read the types from `src` rather than from a `dist` that may not exist:

```json
{
    "compilerOptions": {
        "customConditions": ["source"]
    }
}
```

The app then type-checks the library's source with its own settings, so it needs `allowImportingTsExtensions`, `resolveJsonModule` and `jsx: "react-jsx"`.

Tailwind scans `src` of the checkout instead of `dist`, again relative to the CSS file:

```css
@source "../../react-ui/src";
```

The theme resolves through the `style` condition, which points at `src/theme.css` in the checkout and in the published package alike. If Vite refuses to serve files from the checkout, add its folder to `server.fs.allow`.

## Development

```sh
bun install
bun run check   # typecheck and lint, a warning fails
bun run test
bun run build   # dist: one .js and one .d.ts per source file, and the theme
bun run format
```

Tests sit next to the code (`foo.ts` and `foo.test.ts`). The snapshot in `src/__snapshots__/exports.test.ts.snap` lists every exported name; a change to the public API shows up there as a diff to accept with `bun test --update-snapshots`.

## Releasing

Publishing a GitHub release runs `.github/workflows/release.yml`, which sets the version from the tag, builds and publishes to npm with provenance. A prerelease goes out under the `next` tag.

## License

MIT
