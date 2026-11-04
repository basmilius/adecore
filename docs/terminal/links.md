# Links

HTTP and HTTPS URLs in the output and OSC 8 hyperlinks share one handler. The view ignores other schemes.

## Opening a link

Without `onOpenLink`, a primary click opens the URL in a new window with `noopener,noreferrer`. A desktop app passes the function that opens the system browser instead.

`onOpenLink(uri, event)` gets the target and the mouse event, so the app can ask for Cmd or Ctrl first:

```tsx
<TerminalView
    onOpenLink={(uri, event) => {
        if (event.metaKey || event.ctrlKey) {
            openExternal(uri);
        }
    }}
/>
```

## Showing where a link goes

`onLinkHover(uri, bounds)` gets the target and a `TerminalLinkBounds` rectangle (`x`, `y`, `width`, `height`) in viewport pixels, or two `null` values on leave. The rectangle covers the link's segment on the hovered row, so a tooltip can sit above or below it. A link that wraps carries its whole target on every row.

## Measuring in a link provider of your own

`linkLineBounds(range, grid, screen, pointerY)` does the same measuring for a link provider the app registers on xterm itself. Pass:

- the one-based buffer range of the link,
- the grid as `{ cols, rows, viewportY }`,
- the bounding rectangle of `.xterm-screen`,
- the mouse event's `clientY`.

It returns the hovered row's segment in viewport pixels, or `null` for a screen that has no dimensions yet.
