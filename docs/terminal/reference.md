# Reference

```tsx
import { TerminalView, type TerminalViewHandle } from '@adecore/terminal';
```

## Props

The props are `TerminalViewProps`.

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

The handle is a `TerminalViewHandle`.

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

## Exports

Every name `@adecore/terminal` exports, read from its source. Anything not listed is internal. `@adecore/terminal/terminal.css` holds the styles.

<ExportTable entry="@adecore/terminal" />
