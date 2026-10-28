# @adecore/terminal

A terminal pane on [xterm.js](https://xtermjs.org) in the theme of `@adecore/ui`. It fits its box, opens links and takes typing or only shows output. The app writes output and reads the screen through a handle.

```tsx
import { TerminalView, type TerminalViewHandle } from '@adecore/terminal';
```

<Demo src="terminal/terminal-view" />

## Install

xterm and its addons are peer dependencies, so the app picks the version:

```sh
bun add @adecore/terminal @xterm/xterm @xterm/addon-fit @xterm/addon-web-links @xterm/addon-webgl
```

Import xterm's stylesheet and the package's own after the [theme](/ui/guide/theme) of `@adecore/ui`:

```css
@import "tailwindcss";
@import "@adecore/ui/theme.css";
@import "@xterm/xterm/css/xterm.css";
@import "@adecore/terminal/terminal.css";
```

## Feeding it

`write` on the handle draws output, and `onData` reports what the person types or pastes. A pty takes two lines:

```tsx
const view = useRef<TerminalViewHandle>(null);

useEffect(() => session.onOutput((data) => view.current?.write(data)), [session]);

<TerminalView ref={view} label="Shell" onData={(data) => session.write(data)} onResize={(cols, rows) => session.resize(cols, rows)} className="h-full" />
```

`size()` returns the grid fitted at mount, which a program starts with. After that, `onResize` reports every new grid, debounced during a drag. A host with no room yet keeps xterm's default of 80 by 24 until its first real fit arrives through `onResize`.

`reset()` clears the screen and the scrollback, in order with earlier writes. To replay from the start, call `reset()` and `write` the whole text. `visibleText()` returns the rows on screen as plain text. `paste`, `selectAll` and `selection()` serve a context menu. The scrollback keeps 5000 lines, and Option on a Mac types as Meta.

For captured output, `convertEol` treats a lone line feed as a line break. `readOnly` ignores typing and stops the cursor blinking.

## Several clients on one program

When two windows show the same program, the last one to resize sets its grid. `followGrid(size)` draws the grid the program reports, clipped or padded, until the next local fit claims it back through `onResize`.

## Theme and font

The `--term-*` tokens in `terminal.css` set the background, the foreground, a cursor in the accent and the sixteen ANSI colors. The selection is `--selection`. The font is `--term-font`, or `--font-mono` while that is unset. To give terminals another font than code, set `--term-font` on `<html>`. The terminal rereads the tokens when `data-theme`, `class` or the inline style on `<html>` changes, so theme and accent switches need no prop. `fontSize` (13) and `lineHeight` (1) are props.

## Links

HTTP and HTTPS URLs and OSC 8 hyperlinks share one handler. Other schemes are ignored. Without `onOpenLink`, a primary click opens the URL in a new window with `noopener,noreferrer`. A desktop app passes the function that opens its browser.

`onOpenLink(uri, event)` gets the target and the mouse event, so a host can require Cmd or Ctrl. `onLinkHover(uri, bounds)` gets the target and a `TerminalLinkBounds` rectangle in viewport pixels, or two `null` values on leave. The rectangle covers the link's segment on the hovered row, so a host can place a tooltip above or below it. A wrapped link carries the whole target on every row.

`linkLineBounds(range, grid, screen, pointerY)` does the same measuring for the app's own xterm link provider. Pass the one-based buffer range, `{ cols, rows, viewportY }`, the `.xterm-screen` bounding rectangle and the mouse event's `clientY`. It returns the hovered row segment in viewport pixels, or `null` for a screen without dimensions.

## WebGL

`webgl` draws with WebGL instead of the DOM, which is faster on a busy screen. Browsers cap WebGL contexts per page, so at most ten terminals hold one at a time: the focused one first, then the most recently written. The others draw with the DOM. A terminal that loses its context asks again on its next `focus()`. `webglTerminals()` lists the terminals that hold one, highest ranked first.

The WebGL addon loads on the first grant. To load it earlier, register its import with the [prefetcher](/ui/utilities/lazy-loading) of `@adecore/ui`:

```ts
prefetcher.register(() => import('@xterm/addon-webgl'));
```

## Under a scaled ancestor

Under a CSS transform, such as a zooming canvas, clicks land on the wrong cell. `scaledByAncestor` corrects pointer positions for the scale. It is read at mount.

## The terminal itself

`terminal` on the handle is the xterm instance, for what the props leave to the app: a key handler (`attachCustomKeyEventHandler`), an OSC handler such as one for the clipboard, or a registry of open terminals. A parent's effect already sees it, and it stays until unmount.

## Props

| Prop | Type | |
| --- | --- | --- |
| `onData` | `(data: string) => void` | What the person types or pastes. |
| `onResize` | `(cols: number, rows: number) => void` | A new grid after a resize or a font change. |
| `onOpenLink` | `(uri: string, event: MouseEvent) => void` | Where a web link goes. A new window by default. |
| `onLinkHover` | `(uri: string \| null, bounds: TerminalLinkBounds \| null) => void` | The target under the pointer, or `null` on leave. |
| `fontSize` | `number` | `13` by default. |
| `lineHeight` | `number` | `1` by default. |
| `readOnly` | `boolean` | Shows output only. |
| `convertEol` | `boolean` | A lone line feed is a line break. |
| `webgl` | `boolean` | Draws with WebGL while the budget has room. |
| `scaledByAncestor` | `boolean` | An ancestor scales the terminal. Read at mount. |
| `label` | `string` | Names the terminal as a region. |
| `className` | `string` | The terminal has no size of its own; this gives it one. |
| `ref` | `Ref<TerminalViewHandle>` | The handle. |

## Handle

| Member | |
| --- | --- |
| `terminal` | The xterm instance, or `null` before mount. |
| `write(data, done?)` | Draws output; `done` runs once it is drawn. |
| `reset()` | Clears the screen and the scrollback. |
| `focus()`, `blur()` | Moves the keyboard, and ranks the terminal for WebGL. |
| `paste(text)` | Pastes, bracketed when the program asks for that. |
| `selectAll()`, `selection()` | The selection, empty without one. |
| `size()` | The grid as a `TerminalSize`, `{ cols, rows }`. |
| `visibleText()` | The rows on screen as text. |
| `followGrid(size)` | Draws the grid another client set. |

The exported types are `TerminalViewProps`, `TerminalViewHandle`, `TerminalSize` and `TerminalLinkBounds` (`x`, `y`, `width`, `height`).
