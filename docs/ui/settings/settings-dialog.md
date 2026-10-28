# SettingsDialog

A settings window: sections on the left, one pane on the right, and an optional search that jumps to a row. It lives in its own entry point, `@adecore/ui/settings`, with the parts a pane is built from.

```tsx
import { SettingsDialog } from '@adecore/ui/settings';
```

<Demo src="settings/settings-dialog" />

## Sections and panes

`groups` is the navigation, in order, each group with an optional label. `footer` sections sit at the foot of the navigation. A section names a `pane` component, rendered only while open, inside a `Suspense` and an [`ErrorBoundary`](/ui/display/error-boundary). A lazy pane loads on first open.

A pane is a padded, scrolling column. A `split` section gets the full height instead, for a [`MasterDetail`](/ui/settings/master-detail).

A section with a `hero` opens on that block, edge to edge, with the title bar floating over it. The bar fills in as the pane scrolls. It covers the top 86 pixels of the hero (more when the description wraps), so leave that room. A `split` section draws no hero.

You hold the open section. `onNavigate` fires when a person picks another.

## Search

`search.find(query)` returns the results, so it can search your own words in any language. While the field holds a query, the results replace the navigation. A result names a section and optionally the `searchId` of a [`SettingsRow`](/ui/settings/settings-section). Picking one calls `onNavigate` with the row as `target`. Pass it back as `target`: the row scrolls into view and flashes, then `onTargetShown` fires, where you clear it.

Escape clears the query first and closes the dialog only from an empty field. Enter jumps to the first result. `search.hint` prints the shortcut that focuses the field. `search.focusAt` focuses the field each time the number grows, so your shortcut handler can bump it.

## An account at the foot

`account` adds one more section under the footer, with a tab you draw yourself, such as an avatar and a name. The tab is a Base UI `Tabs.Tab` (from `@base-ui/react/tabs`) with the section's id as value.

## Narrow windows

The dialog is 1200 by 760 pixels and shrinks with the viewport. Under 960 pixels the navigation narrows; under 640 it becomes a select above the pane.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `open` | `boolean` | | Required. |
| `onOpenChange` | `(open: boolean) => void` | | Required. |
| `section` | `string` | | Required. The id of the open section. |
| `onNavigate` | `(next: { section: string; target?: string \| null }) => void` | | Required. |
| `groups` | `readonly SettingsGroupEntry[]` | | Required. `{ label: string \| null; sections }` |
| `footer` | `readonly SettingsSectionEntry[]` | `[]` | |
| `account` | `{ section: SettingsSectionEntry; tab: ReactNode }` | | |
| `search` | `SettingsSearch` | | `{ find(query), hint?, focusAt? }` |
| `target` | `string \| null` | `null` | The row a search result jumped to. |
| `onTargetShown` | `() => void` | | |
| `className` | `string` | | On the popup. |
| `ref` | `Ref<HTMLDivElement>` | | |

A `SettingsSectionEntry` is `{ id, icon, label, description, pane, split?, hero? }`, where the description is the line under the pane's title. A `SettingsSearchResult` is `{ section, id, label }`, with `id: null` for a result that is the pane itself.

`SettingsDialogProps`, `SettingsGroupEntry`, `SettingsSectionEntry`, `SettingsSearch` and `SettingsSearchResult` are exported types.
