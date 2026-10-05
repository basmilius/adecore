# @adecore/terminal

A terminal pane on [xterm.js](https://xtermjs.org) that looks like the rest of an `@adecore/ui` interface in both themes. It fits the box it is given, opens links in the output and either takes typing or only shows output. The app feeds it output and reads back what is on screen through a handle, without touching xterm's addons.

```tsx
import { TerminalView, type TerminalViewHandle } from '@adecore/terminal';
```

<Demo src="terminal/terminal-view" />

## Install

xterm and its addons are peer dependencies, so the app picks the version:

```sh
bun add @adecore/terminal @xterm/xterm @xterm/addon-fit @xterm/addon-web-links @xterm/addon-webgl
```

Import xterm's stylesheet and the package's own after the theme of `@adecore/ui`. The package's stylesheet holds the `--term-*` tokens and the box the terminal sits in; the colors, the selection and the font of the [theme](/ui/guide/theme) apply to the terminal too.

```css
@import "tailwindcss";
@import "@adecore/ui/theme.css";
@import "@xterm/xterm/css/xterm.css";
@import "@adecore/terminal/terminal.css";
```

## Feeding it

The handle is the way in. `write` draws a program's output and `onData` hears what the person types or pastes, so a pty is two lines:

```tsx
const view = useRef<TerminalViewHandle>(null);

useEffect(() => session.onOutput((data) => view.current?.write(data)), [session]);

<TerminalView ref={view} label="Shell" onData={(data) => session.write(data)} onResize={(cols, rows) => session.resize(cols, rows)} className="h-full" />
```

The grid it fits at mount is `size()`, which is what a program starts with. After that `onResize` reports every new grid, debounced while a container is being dragged, and after a font change. Rows that do not fill the height are centered, and the background runs to the edges.

`reset()` clears the screen and the scrollback, in order with the output written before it, so a replay that starts over is `reset()` and a `write` of the whole text. `visibleText()` returns the rows on screen as plain text, such as for a question about what the terminal shows. `paste`, `selectAll` and `selection()` serve a context menu.

For captured output rather than a pty's, `convertEol` treats a lone line feed as a line break, and `readOnly` drops the typing and stops the cursor blinking.

## Several clients on one program

When two windows show the same program, the last one to resize decides its grid. `followGrid(size)` draws the grid the program reports, clipped or with room to spare, until the next fit here changes the grid and `onResize` claims it back.

## Theme and font

The colors come from the `--term-*` tokens in `terminal.css`: a background, a foreground, a cursor that follows the accent and the sixteen colors a program asks for by number. The selection is `--selection` and the font `--font-mono`. The terminal reads them again whenever `data-theme`, `class` or the inline style on `<html>` changes, so a theme switch, a new accent or another monospace font reaches it without a prop. `fontSize` (13 by default) and `lineHeight` (1) are props, since an app usually lets a person set them.

## Links

A URL in the output is a link. Without `onOpenLink` it opens in a new window; a desktop app passes the function that opens it in the browser. Whether the prop is set is read at mount.

## WebGL

`webgl` draws with WebGL instead of the DOM, which is faster on a busy screen. A browser keeps about 16 contexts per page and silently drops the oldest, so every terminal with `webgl` shares one budget of ten: the focused one first, then the ones written to most recently. A terminal that loses its context falls back to the DOM and asks again on its next `focus()`. `webglTerminals()` lists the terminals that hold one, highest ranked first.

The WebGL addon loads on the first grant. Register its import with the [prefetcher](/ui/utilities/lazy-loading) of `@adecore/ui` to have it ready before then:

```ts
prefetcher.register(() => import('@xterm/addon-webgl'));
```

## Under a scaled ancestor

A terminal on a canvas that zooms with a CSS transform measures the pointer against the scaled box, so a click lands on the wrong cell. `scaledByAncestor` corrects every pointer for the scale, for selection, links and mouse reporting alike. It is read at mount.

## The terminal itself

`terminal` on the handle is the xterm instance, for what the props leave to the app: its own key handler (`attachCustomKeyEventHandler`), an OSC handler such as one for the clipboard, or a registry of open terminals. It exists from the first effect after mount until unmount, and a parent's effect already sees it.

## Props

| Prop | Type | |
| --- | --- | --- |
| `onData` | `(data: string) => void` | What the person types or pastes. |
| `onResize` | `(cols: number, rows: number) => void` | A new grid after a resize or a font change. |
| `onOpenLink` | `(uri: string) => void` | Where a link goes. A new window by default. |
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

`TerminalViewProps`, `TerminalViewHandle` and `TerminalSize` are exported types.
