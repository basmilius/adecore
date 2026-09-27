# Migrating from @ruimte/ui

`@basmilius/react-ui` replaces `@ruimte/ui`. This file maps every import, prop and class string of the old package to the new one, precise enough to drive a codemod. Where a change needs a person, it says so under [What does not switch mechanically](#what-does-not-switch-mechanically).

## 1. Setup

### Dependency

```diff
- "@ruimte/ui": "workspace:*"            // or "file:../ruimte/packages/ui"
+ "@basmilius/react-ui": "^<version>"    // or "file:../react-ui" for a local checkout
```

### CSS

```diff
  @import "tailwindcss";
- @import "@ruimte/ui/theme.css";
+ @import "@basmilius/react-ui/theme.css";
- @source "<path>/packages/ui/src";
+ @source "../node_modules/@basmilius/react-ui/dist";   /* from npm */
+ @source "../../react-ui/src";                          /* a linked checkout, relative to the CSS file */
```

The theme gained `--raised-shadow` (`shadow-raised`), used by `Switch` and `Segmented` for what the app's own `shadow-node` used to give them, and `.sliding-column` for `SlidingColumn`. An app that defines `--accent` keeps doing so after the import.

### The provider

One `UIProvider` replaces four things an app wired by hand. Mount it around the tree, above the first component of the library.

```diff
- import { TooltipProvider } from '@ruimte/ui/Tooltip';
- import { startInputModality } from '@ruimte/ui/modality';
- import { setFormatSource } from '@ruimte/ui/format/locale';
- import { UI_LOCALES, UI_NAMESPACE } from '@ruimte/ui/locales';
+ import { UIProvider } from '@basmilius/react-ui';

- startInputModality();
- setFormatSource(source);
- i18next.addResourceBundle(language, UI_NAMESPACE, (await UI_LOCALES[language]()).default, true, true);
- <TooltipProvider><App /></TooltipProvider>
+ <UIProvider i18n={i18next} formatSource={source}><App /></UIProvider>
```

- `UIProvider` adds the `ui` namespace in every language the library ships, synchronously, before the first child renders. `UI_LOCALES` (one async loader per language) is gone; the words are small enough to ship whole. Keep `UI_NAMESPACE` in i18next's `ns` list.
- An app that sets the format source before the first render (so code outside React formats in the right region) keeps calling `setFormatSource` from `@basmilius/react-ui/format` and may leave `formatSource` off the provider, or hand the same object to both.
- A test preload that read `@ruimte/ui/locales/en.json` reads `UI_RESOURCES.en` from `@basmilius/react-ui`, or calls `addUiResources(i18next)` after `init`.

### Vite and TypeScript for a linked checkout

See "Working on a local checkout" in the README: `resolve.conditions: ['source', ...defaultClientConditions]`, `resolve.dedupe` for React, i18next and Base UI, `optimizeDeps.exclude: ['@basmilius/react-ui']`, and `customConditions: ["source"]` in `tsconfig.json`.

## 2. Imports

Every old subpath import becomes a named import from one of four entry points. A name stays the same unless the table says otherwise.

| Old import | New import |
| --- | --- |
| `@ruimte/ui/AccentSwatches`: `AccentSwatches`, `AccentSwatchesProps` | `@basmilius/react-ui`: same names |
| `@ruimte/ui/Button`: `Button` | `@basmilius/react-ui`: `Button` |
| `@ruimte/ui/ChoiceCards`: `ChoiceCards`, `Choice`, `ChoiceCardsProps` | `@basmilius/react-ui`: same names |
| `@ruimte/ui/CloseButton`: `CloseButton` | `@basmilius/react-ui`: `CloseButton` |
| `@ruimte/ui/ColumnResizeHandle`: `ColumnResizeHandle` | `@basmilius/react-ui`: `ColumnResizeHandle` |
| `@ruimte/ui/DisabledReason`: `DisabledReason` | `@basmilius/react-ui`: `DisabledReason` |
| `@ruimte/ui/EmptyState`: `EmptyState` | `@basmilius/react-ui`: `EmptyState` |
| `@ruimte/ui/ErrorBoundary`: `ErrorBoundary` | `@basmilius/react-ui`: `ErrorBoundary` |
| `@ruimte/ui/FileIcon`: `FileIcon` | `@basmilius/react-ui`: `FileIcon` |
| `@ruimte/ui/Icon`: `Icon` | `@basmilius/react-ui`: `Icon` |
| `@ruimte/ui/Kbd`: `Kbd`, `KeyCap`, `Keys` | `@basmilius/react-ui`: same names |
| `@ruimte/ui/MenuCheck`: `MenuCheck` | `@basmilius/react-ui`: `Menu.Check` (see [menus](#menus)) |
| `@ruimte/ui/MenuPopup`: `MenuPopup` | `@basmilius/react-ui`: `Menu.Popup` |
| `@ruimte/ui/PanelEmpty`: `PanelEmpty` | `@basmilius/react-ui`: `PanelEmpty` |
| `@ruimte/ui/Pill`: `Pill` | `@basmilius/react-ui`: `Pill` |
| `@ruimte/ui/PromptDialog`: `PromptDialog` | `@basmilius/react-ui`: `PromptDialog` (prop change below) |
| `@ruimte/ui/Select`: `Select`, `SelectItem`, `SelectGroup` | `@basmilius/react-ui`: same names |
| `@ruimte/ui/Separator`: `Separator` | `@basmilius/react-ui`: `Separator` |
| `@ruimte/ui/ShortcutHints`: `ShortcutHints` | `@basmilius/react-ui`: `ShortcutHints` |
| `@ruimte/ui/TextMenu`: `TextMenu` | `@basmilius/react-ui`: `TextMenu` |
| `@ruimte/ui/Tile`: `Tile` | `@basmilius/react-ui`: `Tile` |
| `@ruimte/ui/Toasts`: `Toasts`, `ToastsProps` | `@basmilius/react-ui`: same names |
| `@ruimte/ui/Tooltip`: `Tooltip`, `TooltipProvider` | `@basmilius/react-ui`: same names (`TooltipProvider` is inside `UIProvider`) |
| `@ruimte/ui/Wipe`: `Wipe` | `@basmilius/react-ui`: `Wipe` (prop change below) |
| `@ruimte/ui/classes`: every constant | a component, see [section 4](#4-class-strings) |
| `@ruimte/ui/clipboard`: `copyText`, `readClipboardText` | `@basmilius/react-ui`: same names |
| `@ruimte/ui/controls`: `Toggle` | `@basmilius/react-ui`: `Switch` (prop change below) |
| `@ruimte/ui/controls`: `Segmented`, `Stepper`, `Skeleton` | `@basmilius/react-ui`: same names (prop changes below) |
| `@ruimte/ui/dialog-layer`: `useDialogLayer` | gone: `Dialog.Popup` stacks by itself |
| `@ruimte/ui/error-boundary`: `ResetKeys` | `@basmilius/react-ui`: `type ResetKeys` |
| `@ruimte/ui/error-boundary`: `shouldReset`, `errorMessageOf`, `errorReport` | internal |
| `@ruimte/ui/error-message`: `messageOf` | `@basmilius/react-ui`: `messageOf` |
| `@ruimte/ui/file-icon`: `FILE_TREE_ICONS` | `@basmilius/react-ui`: `FILE_TREE_ICONS` |
| `@ruimte/ui/file-icon`: `fileIconFor`, `mountFileIconSprite`, `FileIcon`, `FileIconHue` | internal; draw `<FileIcon path>` |
| `@ruimte/ui/floating`: `isInFloatingLayer`, `cameThroughPortal` | `@basmilius/react-ui`: same names |
| `@ruimte/ui/format/datetime`: every name | `@basmilius/react-ui/format`: same names |
| `@ruimte/ui/format/duration`: every name | `@basmilius/react-ui/format`: same names |
| `@ruimte/ui/format/number`: every name | `@basmilius/react-ui/format`: same names |
| `@ruimte/ui/format/regions`: every name | `@basmilius/react-ui/format`: same names |
| `@ruimte/ui/format/time-zone`: `localTimeZone` | `@basmilius/react-ui/format`: `localTimeZone` |
| `@ruimte/ui/format/locale`: `setFormatSource`, `useFormatLocale`, `formatLocale`, `labelCollator`, `systemLocale`, `FALLBACK_LOCALE`, `FormatSource` | `@basmilius/react-ui/format`: same names |
| `@ruimte/ui/format/locale`: `wordLocale`, `numberFormatter`, `dateFormatter`, `wordFormatter`, `relativeFormatter` | internal; use a `format*` function or `formatDateTime(at, options)` |
| `@ruimte/ui/format/fake-source`: `fakeFormatSource`, `FakeFormatSource` | `@basmilius/react-ui/testing`: same names |
| `@ruimte/ui/locales`: `UI_NAMESPACE` | `@basmilius/react-ui`: `UI_NAMESPACE` |
| `@ruimte/ui/locales`: `UI_LOCALES` | `@basmilius/react-ui`: `UI_RESOURCES` (words, not loaders) or `addUiResources(i18n)` |
| `@ruimte/ui/locales/en.json`, `@ruimte/ui/locales/nl.json` | `UI_RESOURCES.en`, `UI_RESOURCES.nl` |
| `@ruimte/ui/modality`: `startInputModality` | `@basmilius/react-ui`: `startInputModality` (inside `UIProvider`) |
| `@ruimte/ui/platform`: `isApplePlatform` | `@basmilius/react-ui`: `isApplePlatform` |
| `@ruimte/ui/platform`: `applePlatformFrom` | internal |
| `@ruimte/ui/selection`: `selectionWithin`, `selectAllWithin` | `@basmilius/react-ui`: same names |
| `@ruimte/ui/settings/ConfirmDialog`: `ConfirmDialog` | `@basmilius/react-ui/settings`: `ConfirmDialog` |
| `@ruimte/ui/settings/DetailHeader`: `DetailHeader` | `@basmilius/react-ui/settings`: `DetailHeader` |
| `@ruimte/ui/settings/DetailHeader`: `REMOVE_BUTTON` | `<Button variant="danger-outline">` |
| `@ruimte/ui/settings/MasterDetail`: `MasterDetail`, `MasterItem` | `@basmilius/react-ui/settings`: same names |
| `@ruimte/ui/settings/SettingsDialog`: `SettingsDialog`, `SettingsSectionEntry`, `SettingsGroupEntry`, `SettingsSearch`, `SettingsSearchResult` | `@basmilius/react-ui/settings`: same names |
| `@ruimte/ui/settings/SettingsRow`: `SettingsRow`, `TopIcon` | `@basmilius/react-ui/settings`: same names |
| `@ruimte/ui/settings/SettingsSection`: `SettingsSection`, `SettingsSectionProps` | `@basmilius/react-ui/settings`: same names |
| `@ruimte/ui/settings/target`: `useSettingsTarget` | `@basmilius/react-ui/settings`: `useSettingsTarget` |
| `@ruimte/ui/settings/target`: `SettingsTargetContext` | internal |
| `@ruimte/ui/shortcut`: every name | `@basmilius/react-ui`: same names |
| `@ruimte/ui/shortcut-hints`: every name | internal; mount `<ShortcutHints />` |
| `@ruimte/ui/toast-store`: every name | `@basmilius/react-ui`: same names |
| `@ruimte/ui/useAsyncAction`: `useAsyncAction` | `@basmilius/react-ui`: `useAsyncAction` |
| `@ruimte/ui/useColumnResize`: `useColumnResize`, `clampColumnSize`, `ColumnEdge` | `@basmilius/react-ui`: same names |
| `@ruimte/ui/useContentSize`: `useContentSize`, `ContentSize` | `@basmilius/react-ui`: same names |
| `@ruimte/ui/useMeasuredWidth`: `useMeasuredWidth` | `@basmilius/react-ui`: `useMeasuredWidth` |
| `@ruimte/ui/useNow`: `useNow`, `useTickingText` | `@basmilius/react-ui`: same names |
| `@ruimte/ui/wipe`: `WIPE_KEY_STEP`, `clampSplit`, `splitAt`, `splitForKey` | internal |
| `@base-ui-components/react/menu`: `Menu` | `@basmilius/react-ui`: `Menu` |
| `@base-ui-components/react/context-menu`: `ContextMenu` | `@basmilius/react-ui`: `ContextMenu` |
| `@base-ui-components/react/dialog`: `Dialog` | `@basmilius/react-ui`: `Dialog` |
| `@base-ui-components/react/popover`: `Popover` | `@basmilius/react-ui`: `Popover` |
| `@base-ui-components/react/preview-card`: `PreviewCard` | `@basmilius/react-ui`: `PreviewCard` |

`Tabs`, `Radio`, `Switch` and the other Base UI parts an app uses directly stay imports from `@base-ui-components/react`.

`isInFloatingLayer` no longer matches `.popup-layer`, a class nothing drew any more; it matches the library's portals, tooltips and dialogs.

## 3. Renamed props

| Component | Old | New |
| --- | --- | --- |
| `Switch` (was `Toggle`) | `onChange(checked)` | `onCheckedChange(checked)` |
| `Segmented` | `onChange(id)` | `onValueChange(id)` |
| `Stepper` | `onChange(value)` | `onValueChange(value)` |
| `AccentSwatches` | `onChange(id)` | `onValueChange(id)` |
| `Wipe` | `split`, `onSplit(split)` | `value`, `onValueChange(value)` |
| `PromptDialog` | `onClose()` | `onOpenChange(open)`; it is only ever called with `false`, so `onClose={close}` becomes `onOpenChange={close}` for a `close` that takes no argument, and `onOpenChange={() => close()}` otherwise |
| `Kbd` | `className={TOOLTIP_KBD}` | `variant="inline"`; `Kbd` also prints `children` when it has no `shortcut` |
| `Stepper`, `Segmented`, `Switch`, `Select`, `Pill`, `Tile`, `EmptyState`, `PanelEmpty`, `Separator`, `ChoiceCards`, `ColumnResizeHandle`, `Wipe`, `Toasts`, `AccentSwatches` | | now take `className` and `ref` |
| `Select` | the default `placeholder` read the global i18next | reads the provider's i18next |
| `ErrorBoundary` | words from the global i18next | words from the provider's i18next |

`Button` gained `variant="danger-outline"` and takes a `ref`. `Separator` gained `className`.

## 4. Class strings

`@ruimte/ui/classes` is gone. Every constant is a component or a prop now; none is exported as a string. The component carries the classes, so a call site keeps only its own extra classes. A caller's utility never has to fight the component's: where a component sets a size or a color, that is a prop.

Parts that are one element take Base UI's `render` prop, which swaps the element and merges the props and classes of both. That is how a class string on an arbitrary element becomes a component.

### `MENU_SEPARATOR` → `Menu.Separator`

```diff
- <Menu.Separator className={MENU_SEPARATOR} />
+ <Menu.Separator />
- <ContextMenu.Separator className={MENU_SEPARATOR} />
+ <ContextMenu.Separator />
- <div className={MENU_SEPARATOR} />
+ <Menu.Separator />
```

### `BTN_GROUP` → `ButtonGroup`

```diff
- <div className={BTN_GROUP}>…</div>
+ <ButtonGroup>…</ButtonGroup>
- <div className={`${BTN_GROUP} shrink-0 rounded-lg`} role="group">…</div>
+ <ButtonGroup className="shrink-0 rounded-lg" role="group">…</ButtonGroup>
- <span className={BTN_GROUP}>…</span>
+ <ButtonGroup render={<span />}>…</ButtonGroup>
```

### `SECTION_LABEL` → `SectionLabel`

```diff
- <span className={SECTION_LABEL}>Recent</span>
+ <SectionLabel>Recent</SectionLabel>
- <h3 className={clsx(SECTION_LABEL, 'px-2')}>Recent</h3>
+ <SectionLabel render={<h3 />} className="px-2">Recent</SectionLabel>
- <div className={`${SECTION_LABEL} mt-4 flex items-center`}>…</div>
+ <SectionLabel render={<div />} className="mt-4 flex items-center">…</SectionLabel>
- <button className={clsx(SECTION_LABEL, 'focus-ring flex h-8')} onClick={toggle}>…</button>
+ <SectionLabel render={<button type="button" onClick={toggle} />} className="focus-ring flex h-8">…</SectionLabel>
```

A label with a field under it becomes `Field` (below).

### `MENU_LABEL` → `Menu.Label` or `Menu.GroupLabel`

```diff
- <div className={MENU_LABEL}>Stroke</div>
+ <Menu.Label>Stroke</Menu.Label>
- <Menu.GroupLabel className={`${MENU_LABEL} flex items-center gap-1.5`}>…</Menu.GroupLabel>
+ <Menu.GroupLabel className="flex items-center gap-1.5">…</Menu.GroupLabel>
```

### `MENU_HINT` → `Menu.Hint`

```diff
- <span className={MENU_HINT}>{formatClock(until)}</span>
+ <Menu.Hint>{formatClock(until)}</Menu.Hint>
```

### `SMALL_DIALOG`, `DIALOG_DESCRIPTION`, `DIALOG_FOOTER` → `Dialog` parts

```diff
- <Dialog.Root open={open} onOpenChange={setOpen}>
-     <Dialog.Portal>
-         <Dialog.Backdrop className="dialog-backdrop" />
-         <Dialog.Popup className={SMALL_DIALOG}>
-             <Dialog.Title className="text-base font-semibold text-text">Rename</Dialog.Title>
-             <Dialog.Description className={clsx(DIALOG_DESCRIPTION, 'mt-1')}>…</Dialog.Description>
-             <p className={`${DIALOG_DESCRIPTION} mt-2`}>…</p>
-             <div className={DIALOG_FOOTER}>…</div>
-         </Dialog.Popup>
-     </Dialog.Portal>
- </Dialog.Root>
+ <Dialog.Root open={open} onOpenChange={setOpen}>
+     <Dialog.Popup size="sm">
+         <Dialog.Title>Rename</Dialog.Title>
+         <Dialog.Description className="mt-1">…</Dialog.Description>
+         <Dialog.Text className="mt-2">…</Dialog.Text>
+         <Dialog.Footer>…</Dialog.Footer>
+     </Dialog.Popup>
+ </Dialog.Root>
```

- `Dialog.Popup` draws the portal and the backdrop. `size="sm"` is `SMALL_DIALOG`; without a size the popup is as wide as its `className` says (`className="flex h-[600px] w-[1080px] flex-col"`).
- `Dialog.Title` already is `text-base font-semibold text-text`; drop those classes. A title in `text-lg` is `size="lg"`.
- `Dialog.Description` is `text-sm text-text-muted` (`DIALOG_DESCRIPTION`). A description in `text-xs text-text-muted` is `size="xs"`. The margin stays the caller's.
- A `<p className={DIALOG_DESCRIPTION}>` that is not the dialog's description becomes `Dialog.Text` (same sizes).
- `Dialog.Footer` is `DIALOG_FOOTER`, `mt-4` included.

### `FIELD_HINT`, `FORM_ERROR`, `MULTILINE_FIELD` and `.field` → `Field`, `FieldHint`, `FormError`, `Input`, `TextArea`

```diff
- <label className="flex flex-col gap-1.5">
-     <span className={SECTION_LABEL}>Name</span>
-     <input className="field" value={name} onChange={…} />
- </label>
- <p className={FIELD_HINT}>Shown in the sidebar</p>
+ <Field label="Name" hint="Shown in the sidebar">
+     <Input value={name} onChange={…} />
+ </Field>
- <p className={FIELD_HINT}>…</p>
+ <FieldHint>…</FieldHint>
- <p className={clsx(FORM_ERROR, 'mt-2')} role="alert">{failure}</p>
+ <FormError className="mt-2">{failure}</FormError>
- <span className={FORM_ERROR}>…</span>
+ <FormError render={<span />}>…</FormError>
- <textarea className={MULTILINE_FIELD} … />
+ <TextArea size="sm" … />
- <textarea className="field h-auto min-h-24 resize-none py-1.5" … />
+ <TextArea rows={4} … />
- <input className="field field-sm" … />
+ <Input size="sm" … />
- <input className="field font-mono text-code" … />
+ <Input mono … />
```

`TextArea` takes `size` like `Input`, and its default is the body text of an input; `MULTILINE_FIELD` was the smaller type, which is `size="sm"`. A caller's `min-h-*` would fight its own `min-h-16`, so a taller one takes `rows`, and `resize="vertical"` replaces a `resize-y` of the caller's.

`FormError` carries `role="alert"`. Inside a `Field`, an `Input` or `TextArea` gets the label's `id`, is described by the hint and the error, and is marked invalid while there is an error. The `.field` rule stays in the theme for an element that only looks like a field (a read-only path in a box).

### `FLOAT` → `Surface`

```diff
- <div className={`${FLOAT} flex items-center gap-3 rounded-lg px-3 py-2`}>…</div>
+ <Surface className="flex items-center gap-3 rounded-lg px-3 py-2">…</Surface>
- <Button size="sm" className={clsx(FLOAT, 'pointer-events-auto')} …>…</Button>
+ <Surface render={<Button size="sm" … />} className="pointer-events-auto">…</Surface>
- <Popover.Trigger className={CHIP}>…</Popover.Trigger>        // CHIP = `${FLOAT} …`
+ <Surface render={<Popover.Trigger />} className="…">…</Surface>
```

### `PANEL_HEADER` → `PanelHeader`

```diff
- <header className={clsx(PANEL_HEADER, 'app-drag')}>
-     <span className={SECTION_LABEL}>Files</span>
-     …
- </header>
+ <PanelHeader title="Files" className="app-drag">
+     …
+ </PanelHeader>
- <div className={PANEL_HEADER}>…</div>
+ <PanelHeader render={<div />}>…</PanelHeader>
```

A header that places the name itself (a slot before it, a title with classes of its own) leaves `title` out and draws its own `SectionLabel`.

### `FLAT_ROW`, `INSET_ROW` → `ListRow`

```diff
- <div className={`${FLAT_ROW} gap-1.5 pr-3 pl-1 hover:bg-surface-hover`}>…</div>
+ <ListRow variant="flat" className="gap-1.5 pr-3 pl-1 hover:bg-surface-hover">…</ListRow>
- <button className={`${INSET_ROW} w-full gap-2 text-left`} onClick={open}>…</button>
+ <ListRow variant="inset" render={<button type="button" onClick={open} />} className="w-full gap-2 text-left">…</ListRow>
```

### `TOOLTIP_KBD` → `Kbd variant="inline"`

```diff
- <kbd className={TOOLTIP_KBD}>↑</kbd>
+ <Kbd variant="inline">↑</Kbd>
- <Kbd shortcut={APP_SHORTCUTS.palette} className={TOOLTIP_KBD} />
+ <Kbd shortcut={APP_SHORTCUTS.palette} variant="inline" />
```

### `ACCENT_SWATCH`, `ACCENT_SWATCH_PICKED` → `ColorSwatch`

```diff
- <ContextMenu.Item aria-label={name} className={clsx(ACCENT_SWATCH, picked && ACCENT_SWATCH_PICKED)} style={{ background: color }} onClick={pick}>
-     {picked && <Icon icon={Check} size={12} />}
- </ContextMenu.Item>
+ <ColorSwatch render={<ContextMenu.Item unstyled />} aria-label={name} color={color} picked={picked} on="popup" onClick={pick} />
- <ContextMenu.Item aria-label={none} className={clsx(ACCENT_SWATCH, 'border border-border-strong text-text-muted')} onClick={clear}>
-     {!accent && <Icon icon={Check} size={12} />}
- </ContextMenu.Item>
+ <ColorSwatch render={<ContextMenu.Item unstyled />} aria-label={none} picked={!accent} onClick={clear} />
```

A swatch without a `color` is the outlined circle; it draws the tick while picked and whatever children it is handed instead. `unstyled` keeps the row's padding and highlight off the swatch, so a `className="p-0"` that did that goes.

### `REMOVE_BUTTON` → `Button variant="danger-outline"`

```diff
- <button type="button" className={REMOVE_BUTTON} onClick={forget}>Forget</button>
+ <Button variant="danger-outline" onClick={forget}>Forget</Button>
```

A disabled one now dims to 50% like every other button, where it was 40%.

## 5. `.icon-btn` → `IconButton`

```diff
- <Tooltip label="Close" kbd={SHORTCUTS.close} name>
-     <button className="icon-btn icon-btn-sm" onClick={close}>
-         <Icon icon={X} size={14} />
-     </button>
- </Tooltip>
+ <IconButton icon={X} size="sm" label="Close" kbd={SHORTCUTS.close} onClick={close} />
```

| Old | New |
| --- | --- |
| `className="icon-btn"` | no `size` (32, icon 16) |
| `icon-btn-sm`, `icon-btn-xs`, `icon-btn-2xs` | `size="sm"` (icon 14), `size="xs"` (12), `size="2xs"` (12); drop the `<Icon size>`, the button sizes it |
| `<Icon icon={X} />` as the only child | `icon={X}` |
| `<Icon icon={X} className="animate-spin" />` | `icon={X} spin` |
| `<Tooltip label={a} name>` around it | `label={a}` |
| `<Tooltip label={a}>` with `aria-label={a}` on the button | `label={a}` |
| `<Tooltip label={b}>` with `aria-label={a}` on the button | `label={a} tooltip={b}` |
| `aria-label={a}` and no `Tooltip` | `label={a} tooltip={false}` |
| `Tooltip` `kbd`, `side` | `kbd`, `tooltipSide` |
| `data-active="true"` or `data-active={x \|\| undefined}` | `active` or `active={x}` |
| `aria-pressed`, `disabled`, `type`, `tabIndex`, handlers | unchanged |
| other classes (`ml-auto`, `-my-1`, `text-positive`) | `className` |
| children beside the icon with `w-auto` | `children`, `className="w-auto …"` |
| `<Menu.Trigger className="icon-btn">` | `<IconButton render={<Menu.Trigger />} … />` |
| `<Popover.Trigger className="icon-btn">` | `<IconButton render={<Popover.Trigger />} … />` |
| `<Dialog.Close className="icon-btn">` | `<CloseButton dialog label=… />` or `render={<Dialog.Close />}` |

A `Tooltip` around a `Menu.Trigger` with the icon button inside becomes one `IconButton` with `render={<Menu.Trigger />}`: the tooltip and the trigger merge onto the same button, as before. The `.icon-btn` rules stay in the theme and `IconButton` is built on them.

## 6. Base UI patterns

### Menus

```diff
- <Menu.Root>
-     <Tooltip label="More" name>
-         <Menu.Trigger className="icon-btn"><Icon icon={Ellipsis} /></Menu.Trigger>
-     </Tooltip>
-     <Menu.Portal>
-         <Menu.Positioner className="z-(--z-popup)" side="top" sideOffset={10} align="end">
-             <Menu.Popup className="menu-popup min-w-52">
-                 <Menu.Item className="menu-item" onClick={a}>…</Menu.Item>
-                 <Menu.Separator className={MENU_SEPARATOR} />
-                 <Menu.RadioGroup value={v} onValueChange={set}>
-                     <Menu.RadioItem value="x" className="menu-item"><MenuCheck kind="radio" />X</Menu.RadioItem>
-                 </Menu.RadioGroup>
-                 <Menu.CheckboxItem className="menu-item" checked={c} onCheckedChange={setC}><MenuCheck kind="checkbox" />C</Menu.CheckboxItem>
-                 <Menu.SubmenuRoot>
-                     <Menu.SubmenuTrigger className="menu-item">
-                         More <Icon icon={ChevronRight} size={14} className="ml-auto text-text-faint" />
-                     </Menu.SubmenuTrigger>
-                     <Menu.Portal>
-                         <Menu.Positioner className="z-(--z-popup)" sideOffset={4} alignOffset={-4}>
-                             <Menu.Popup className="menu-popup">…</Menu.Popup>
-                         </Menu.Positioner>
-                     </Menu.Portal>
-                 </Menu.SubmenuRoot>
-             </Menu.Popup>
-         </Menu.Positioner>
-     </Menu.Portal>
- </Menu.Root>
+ <Menu.Root>
+     <IconButton icon={Ellipsis} label="More" render={<Menu.Trigger />} />
+     <Menu.Popup side="top" sideOffset={10} align="end" className="min-w-52">
+         <Menu.Item onClick={a}>…</Menu.Item>
+         <Menu.Separator />
+         <Menu.RadioGroup value={v} onValueChange={set}>
+             <Menu.RadioItem value="x">X</Menu.RadioItem>
+         </Menu.RadioGroup>
+         <Menu.CheckboxItem checked={c} onCheckedChange={setC}>C</Menu.CheckboxItem>
+         <Menu.SubmenuRoot>
+             <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
+             <Menu.Popup>…</Menu.Popup>
+         </Menu.SubmenuRoot>
+     </Menu.Popup>
+ </Menu.Root>
```

The rules, one by one:

1. `Menu.Portal > Menu.Positioner > Menu.Popup` becomes one `Menu.Popup`. Every prop of the positioner except `className` moves onto `Menu.Popup` (`side`, `align`, `sideOffset`, `alignOffset`, `collisionPadding`, `collisionBoundary`, `collisionAvoidance`, `anchor`, `sticky`, `positionMethod`). Drop `z-(--z-popup)` and `menu-popup`; keep the other popup classes.
2. `Menu.Popup` places itself when a prop is left out: under a `Menu.Root` at `side="bottom" align="start" sideOffset={6}` (the old `MenuPopup`), under a `Menu.SubmenuRoot` at `sideOffset={4} alignOffset={-4}`, under a `ContextMenu.Root` where the pointer is. A raw positioner at the top level that left `align` or `sideOffset` out relied on Base UI's `center` and `0`, and now says `align="center"` or `sideOffset={0}`.
3. `<MenuPopup …>` becomes `<Menu.Popup …>` with the same props.
4. `className="menu-item"` on `Item`, `RadioItem`, `CheckboxItem` and `SubmenuTrigger` is built in; drop it and keep the rest (`className="menu-item items-start"` becomes `className="items-start"`).
5. `<MenuCheck kind="radio" />` and `<MenuCheck kind="checkbox" />` without `checked` are built into `Menu.RadioItem` and `Menu.CheckboxItem`; delete them, wherever the row is drawn. `<MenuCheck kind=… checked={x} />` on a plain row becomes `<Menu.Check kind=… checked={x} />`.
6. `Menu.SubmenuTrigger` draws the trailing chevron; delete an `<Icon icon={ChevronRight} … className="ml-auto text-text-faint" />` in it. A submenu trigger that had no chevron gets `chevron={false}`.
7. `Menu.Group`, `Menu.RadioGroup`, `Menu.Trigger` are Base UI's own.

### Context menus

The same rules. `ContextMenu.Root` and `ContextMenu.Trigger` are the context menu's; every other part (`ContextMenu.Popup`, `ContextMenu.Item`, `ContextMenu.Separator`, `ContextMenu.SubmenuRoot`, …) is the menu's own under a second name, so rows can be shared between a menu and a context menu.

```diff
- <ContextMenu.Portal>
-     <ContextMenu.Positioner className="z-(--z-popup)">
-         <ContextMenu.Popup className="menu-popup">…</ContextMenu.Popup>
-     </ContextMenu.Positioner>
- </ContextMenu.Portal>
+ <ContextMenu.Popup>…</ContextMenu.Popup>
```

### Dialogs

1. `Dialog.Portal > Dialog.Backdrop + Dialog.Popup` becomes one `Dialog.Popup`. Popup props (`initialFocus`, `finalFocus`, handlers) stay on it; `keepMounted` of the portal moves onto it.
2. `className="dialog-popup …"` drops `dialog-popup`; `className={SMALL_DIALOG}` becomes `size="sm"`.
3. Nesting: `useDialogLayer`, `stacked && 'dialog-backdrop-nested'`, `stacked && 'dialog-popup-nested'` and `forceRender={stacked}` go away; a dialog that opens while another is up stacks by itself. A dialog that was always nested (`dialog-backdrop-nested` with `forceRender`, or `PromptDialog nested`) gets `nested`.
4. A backdrop with a class of its own (`dialog-backdrop lightbox-backdrop`) becomes `backdropClassName="lightbox-backdrop"`. A dialog without a backdrop gets `backdrop={false}`.
5. `Dialog.Root` keeps every prop. `Dialog.Title` and `Dialog.Description` change as in section 4, under the `Dialog` parts.

### Popovers and preview cards

```diff
- <Popover.Portal>
-     <Popover.Positioner className="z-(--z-popup)" side="top" sideOffset={8} align="start">
-         <Popover.Popup className="picker-popup w-80" initialFocus={input}>…</Popover.Popup>
-     </Popover.Positioner>
- </Popover.Portal>
+ <Popover.Popup variant="picker" side="top" className="w-80" initialFocus={input}>…</Popover.Popup>
```

- Positioner props move onto the popup as for menus. The defaults are `side="bottom" align="start" sideOffset={8}`.
- `menu-popup` is `variant="menu"` (the default), `picker-popup` is `variant="picker"`, and a popup that draws its own surface (`rounded-xl border bg-surface shadow-float`) is `variant="plain"` with its classes.
- `PreviewCard.Portal > Positioner > Popup` becomes `PreviewCard.Popup` the same way.

## 7. Pieces that moved into the library

| Was in the app | Now | Changes |
| --- | --- | --- |
| `shell/Banner.tsx`: `Banner`, `BannerTone` | `Banner`, `BannerTone` | takes `className` for its position (default `absolute inset-x-0 top-3 z-20`) and `ref` |
| `shell/SlidingColumn.tsx`: `SlidingColumn` | `SlidingColumn` | `onWidth` → `onWidthChange`; `columnRef` → `ref`; `restoreWithProject` and `useInstantWidth()` → `instant={restoreWithProject && restoring}`; `.panel-shell` → `.sliding-column` in the theme |
| `ui/DockShell.tsx`: `DockShell` | `DockShell` | the setting it read is `autoHide={dockAutoHide}`; `data-holds-dock` unchanged |
| `ui/IconPicker.tsx`: `IconPicker` | `IconPicker` | `icons={record of name → LucideIcon}` in grid order; `value` is the icon's name or `null`; `onChange(choice)` → `onValueChange(name)`; `gridLabel` → `label`; its words (`Icon`, `No icon`) are the library's, so `common:icon.label` and `common:icon.none` may go; the label's `mt-4` is the caller's `className` |
| `ui/ZoomControls.tsx`: `ZoomControls` | `ZoomControls` | `onZoomTo` → `onZoomChange`; `presets` defaults to `ZOOM_PRESETS` (25 to 200); `labels` and `shortcuts` are optional, each word falls back to the library's; `selection.shortcut` is optional |
| `ui/lazy.tsx`: `lazyNamed`, `lazyDialog`, `LoadedComponent` | same names | unchanged |
| `ui/prefetch.ts`: `Prefetcher`, `prefetcher`, `Loader`, `WhenIdle` | same names | unchanged; `prefetcher.busy` still tells a stale-chunk handler that only a prefetch failed |

Left in the app, because they read its own state: `shell/Panel.tsx` (the panel registry and its store; its header becomes `PanelHeader`), `shell/useInstantWidth.ts` (becomes the `instant` prop), `shell/Snooze.tsx` (the snooze store; its menus use `Menu.Popup` and `Menu.Hint`), `CommandPalette` and `SplitGrid`.

## What does not switch mechanically

- Class strings composed into the app's own constants (`const ROW = \`${INSET_ROW} w-full gap-2\``, `const CHIP = \`${FLOAT} …\``, `const LOG_ROW = \`${FLAT_ROW} …\``) become a component at every place the constant is used, usually with `render`, since the element differs per use.
- `.icon-btn` buttons whose tooltip text differs from their accessible name, that have no tooltip, or whose icon is computed (`size={compact ? 12 : 14}`) need a look for `tooltip`, `tooltip={false}` and `size`.
- A caller's utility that set the same property as a component default (`Dialog.Title` with `text-lg`, a `Dialog.Popup` padding other than `p-5` with `size="sm"`) is a prop now or loses to nothing reliably; use the prop or drop `size`.
- `useDialogLayer` in a dialog of the app's own goes away with the move to `Dialog.Popup`; a dialog that also used it for something other than the backdrop and the popup classes needs a look.
- `PromptDialog`'s `onClose` handlers that take an argument.
- `IconPicker` values of the app's own shape (`{ kind: 'lucide', value }`) map to and from the icon's name at the call site.
