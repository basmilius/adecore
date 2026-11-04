# Keyboard and screen reader

The plot is one tab stop, a `group` with the role description "chart" and `label` as its name.

| Key | Moves the cursor |
| --- | --- |
| Arrow Left, Arrow Right | To the previous or the next bucket |
| Home, End | To the first or the last bucket |
| Page Up, Page Down | To the first bucket of the previous or the next group |
| Escape | Clears it |
| Enter, Space | Picks the bucket, with `onActivate` |

A scatter moves between points instead; see [cursor, keyboard and picks](/charts/scatter#cursor-keyboard-and-picks). A [heatmap](/charts/heatmap) and a [timeline](/charts/timeline) have keys of their own.

The pointer and the keyboard keep separate places. When the pointer leaves, the cursor returns to the keyboard's bucket.

## What a screen reader hears

A polite live region reads each bucket the keyboard reaches ("14:00, Errors 12, Warnings 3"). With `onActivate`, every bucket is a button with that name instead, and the live region stays quiet. `Chart.Table` makes every value readable without the cursor.

## Escape in a dialog

The Escape that clears the cursor stops at the chart, so a surrounding dialog stays open until a second Escape.

## Decorative charts

A decorative chart takes `interactive={false}` and becomes an image named by `label`, with no tab stop, keys or live region. The pointer still moves the cursor and the tooltip.

## Empty data

A chart without data says "No data". The loading state stays with the app.
