# Tabs

Many views of one thing in a narrow pane, each tab with how much its view holds: "Links 12", "Attachments 2". A compound component on Base UI's tabs. To pick one of a few modes, such as list or grid, use [`Segmented`](/ui/inputs/segmented) instead.

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
| `Tabs.Root` | Holds the picked tab: `value` and `onValueChange(value)`, or `defaultValue`. |
| `Tabs.List` | The strip, with a border along its bottom and a menu for the tabs that do not fit. Name it with `aria-label`. |
| `Tabs.Tab` | One tab, with its `value`. `disabled` keeps it out of reach. |
| `Tabs.Count` | The number after a label, written the way the region writes numbers. Nothing at zero. |
| `Tabs.Panel` | The view of one tab, shown while that tab is picked. |

## The strip

The picked tab is underlined over the strip's border, the others are muted. The strip has no padding of its own along the sides, so its border can run the width of the pane; `className` on `Tabs.List` gives the tabs their inset, such as `px-4`.

## Tabs that do not fit

The strip never scrolls or wraps. It shows the tabs that fit from the start, and a chevron at its end opens a menu with the rest, each with its icon and its count. Picking one there makes it the picked tab. The picked tab always stays in the strip: when it is one that would not fit, it takes the place of the last tab before the chevron. The demo below puts eight views in a pane too narrow for them; drag its corner to make it wider.

<Demo src="layout/tabs-overflow" />

The strip measures its tabs before it draws, so nothing jumps on the first paint. It reads what a tab holds from its props, so the tabs are the direct children of `Tabs.List`, or an array of them.

## Panels

`Tabs.Panel` holds the view of one tab and links it to its tab for a screen reader. Only the panel of the picked tab is mounted, unless it has `keepMounted`. A screen that draws its view itself, below the strip, can leave the panels out.

## Icons

A tab takes an [`Icon`](/ui/display/icon) before its label, at 14 pixels.

<Demo src="layout/tabs-icons" />

## Keyboard

The arrow keys move between tabs and wrap around at the ends, Home and End go to the first and the last, and Enter or Space picks the focused one. With `activateOnFocus` on `Tabs.List`, landing on a tab picks it. Tab moves on to the panel. A disabled tab is skipped.

`TabsRootProps`, `TabsListProps`, `TabsCountProps` and `TabsValue` are exported types.
