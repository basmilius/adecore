# Visuals

A visual is a page an agent published in a chat, such as a chart or a mockup. The [`Timeline`](/agents-react/chat/timeline) draws each one in the thread, in the app's theme. The record, the bridge and the host page live in [`@adecore/agent-contracts/visual`](/agent-contracts/visuals).

Nothing is drawn until the host sets [`visuals`](/agents-react/guide/host#visuals).

## Where a visual goes

The chat client keeps a chat's visuals in `ChatState.visuals`, from the attach and every `chat.visuals` event. The timeline places a visual by its `at`, before the first row that began after it. In a settled turn it lands above the closing answer.

```ts
import { timedRowsOf, withTimedRows } from '@adecore/agents-react/chat';

const rows = withTimedRows(threadRows, timedRowsOf(cards, visuals, heldFrom));
```

`withTimedRows(rows, timed)` puts `TimedRow`s (`{ at, row }`) among the rows. `timedRowsOf(cards, visuals, heldFrom)` builds them from your thread cards and the visuals (`null` when the host draws none). A visual row is `{ kind: 'visual', id, visual }`.

## The row

Each visual gets its own row inside an `ErrorBoundary`, in the reply column. With `layout: "wide"` it takes the chat pane's width, clear of the scrubber (`STRIP_CLEARANCE_PX`). Its top right corner holds an expand button and a menu with the host's `visuals.actions` and Remove. They show on hover or focus, and always on touch screens.

The timeline draws the large view and the removal question once per thread. `useVisualDialog` holds which visual has either open. Remove deletes the page for good through `chat.removeVisual`.

## The frame

The frame loads the host's `frameUrl` in `<iframe sandbox="allow-scripts allow-forms">`, so the page runs on an opaque origin. A theme change never reloads it.

`VisualPageFrame({ page, title, maxHeight?, fill?, className? })` draws the same frame outside a thread, such as for a page your app kept. `page` returns the HTML; keep it the same function while the page is the same, since a new one reloads the frame. `fill` lets the page scroll inside its positioned parent. It draws nothing without the host's `visuals`.

`VisualBridge` talks to the frame's window (`VisualFrameWindow`), with `VisualBridgeOptions`:

- Once the host page listens, it sends the page (through `attachments.read`) and the theme.
- An inline row takes the content height the page reports. The frame is sticky and never taller than the scroll area; `setViewport` tells it where the timeline stands.
- It opens a link through the host's `openLink` only while the frame has focus and a person's activation is live.
- When the host page stays silent or the page cannot be read, the frame says it could not load the visual.

The viewport unloads nothing inside a visual, so a heavy page has to render lazily itself.

These helpers are for a timeline of your own:

- `initialVisualContentHeight` and `rememberVisualHeight` keep a row's height across remounts. `visualContentHeight` rounds and bounds a reported height. `initialVisualHeight` and `clampVisualHeight` keep the capped heights for older hosts.
- `rowPosition(kind, top)` places a visual row with `top` and others with a transform, since a transform on an ancestor breaks the sticky frame.
- `visualViewportGeometry(contentHeight, availableHeight, top)` returns a `VisualViewportGeometry`: the frame height and its content offset.
- `VisualViewportController` keeps the iframe in step with the scroll without a React update, and hands wheel, keys and touch over the page to the timeline.

## The theme

`useVisualTheme(ref)` builds the page's theme from the app's tokens at the frame and updates every frame live when the theme changes. `visualThemeOf(tokens, appearance, background)` is the mapping over `VisualTokens`:

| Page variable                          | From                                                |
| -------------------------------------- | --------------------------------------------------- |
| `--background`                         | What lies behind the frame (`backgroundBehind`)     |
| `--foreground` and the foregrounds of the card, the popover, `--secondary` and `--accent` | `--text` |
| `--muted`, `--secondary`, `--accent`   | `--surface-hover`                                   |
| `--muted-foreground`                   | `--text-muted`                                      |
| `--card`, `--popover`                  | `--surface-raised`                                  |
| `--border`, `--input`                  | `--border`, `--border-strong`                       |
| `--primary`, `--ring`, `--chart-1`     | `--accent`                                          |
| `--primary-foreground`, `--destructive-foreground` | `--accent-text`                         |
| `--destructive`, `--warning`, `--success`, `--info` | `--status-error`, `--status-needs-you`, `--positive`, `--status-running` |
| `--success-foreground`                 | `--positive-text`                                   |
| `--code-background`, `--code-foreground` | `--chat-code-bg`, `--chat-output`                 |
| `--chart-2` to `--chart-6`             | The tokens of the same names                        |
| `--radius`, `--font-sans`, `--font-mono` | `--radius-lg`, `--font-sans`, `--font-mono`       |

Colors arrive computed, so a page's script can parse them. A token the app does not set keeps the page's default, as do `--warning-foreground` and `--info-foreground`. `backgroundBehind(layers)` takes the computed backgrounds from the frame outward and returns the first opaque ground with the translucent ones laid over it.
