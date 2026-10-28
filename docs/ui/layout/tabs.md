# Tabs

Several views of one thing in a narrow pane, each tab with a count: "Links 12", "Attachments 2". A compound component on Base UI's tabs. To pick a mode such as list or grid, use [`Segmented`](/ui/inputs/segmented).

```tsx
import { Tabs } from '@adecore/ui';
```

<Demo src="layout/tabs" />

```tsx
<Tabs.Root value={view} onValueChange={setView}>
    <Tabs.List aria-label="Message views" className="px-4">
        <Tabs.Tab value="links">
            Links
            <Tabs.Count value={links.length} />
        </Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="links">…</Tabs.Panel>
</Tabs.Root>
```

## Parts

| Part | What it is |
| --- | --- |
| `Tabs.Root` | Holds the picked tab: `value` and `onValueChange(value)`, or `defaultValue` (`0` when left out). |
| `Tabs.List` | The strip, with a border along its bottom and a menu for the tabs that do not fit. Name it with `aria-label`. `start` holds what comes before the tabs, `end` actions after them, `after` actions right beside the last tab. |
| `Tabs.Tab` | One tab, with its `value`. `disabled` keeps it out of reach. `onClose` makes it closable, `pinned` keeps it in the strip without a close button. |
| `Tabs.Count` | The number after a label, as a [`Pill`](/ui/actions/pill), formatted for the region. Hidden at zero. |
| `Tabs.Panel` | The view of one tab, shown while that tab is picked. |

## The strip

The picked tab is underlined over the strip's border. The strip has no side padding, so its border spans the pane; inset the tabs with `className` on `Tabs.List`, such as `px-4`.

## Tabs that do not fit

The strip never scrolls or wraps. Tabs that do not fit go into a "More" menu at its end, with their icons and counts. The picked tab always stays in the strip, replacing the last visible tab if needed. Drag the demo's corner to resize it.

<Demo src="layout/tabs-overflow" />

The strip reads tabs from their props, so they must be direct children of `Tabs.List`, or an array of them.

## Closable tabs

`onClose` on `Tabs.Tab` draws a close button and also fires on a middle click and on Delete or Backspace. It only asks: remove the tab from your list yourself, and pick the next one if it was picked. The close button is out of the tab order. Tabs in the "More" menu have no close button.

`overflow="scroll"` on `Tabs.List` scrolls an overflowing row sideways instead of using "More". Hidden edges fade and the picked tab scrolls into view. The row carries the class `tabs-scroll`.

`variant="pill"` on `Tabs.List` draws each tab as a key in a bar, filled when picked. Use it for tabs in a toolbar, where an underline would read as the pane's tabs. `TabsVariant` is its type.

`end` on `Tabs.List` holds actions at the end of the strip and `start` before the tabs; both keep their width and the tabs fit in the rest. `after` sits right beside the last tab, for a plus that adds one.

<Demo src="layout/tabs-closable" />

## Pinned tabs

`pinned` on `Tabs.Tab` hides the close button and ignores `onClose`. Like the picked tab, a pinned tab never moves into "More". The element carries `data-pinned`. Put pinned tabs at the start of your list.

<Demo src="layout/tabs-pinned" />

## Panels

`Tabs.Panel` holds one tab's view and links it to the tab for screen readers. Only the picked panel is mounted, unless it has `keepMounted`. A screen that draws its own view below the strip can leave the panels out.

## Icons

A tab takes an [`Icon`](/ui/display/icon) before its label, at 14 pixels.

<Demo src="layout/tabs-icons" />

## Keyboard

The arrow keys move between tabs and wrap. Home and End go to the first and last. Enter or Space picks the focused tab, or focus alone with `activateOnFocus` on `Tabs.List`. Disabled tabs are skipped.

## Types

`TabsRootProps`, `TabsListProps`, `TabsTabProps`, `TabsCountProps` and `TabsValue` are exported types.
