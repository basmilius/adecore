# Visuals

A visual is a page an agent published in a chat: a chart, a table, a diagram, a mockup. The [`Timeline`](/agents-react/chat/timeline) draws each one in the thread, borderless on the thread's own ground and as wide as the reply, in the app's theme. The record, the bridge and the host page are [`@adecore/agent-contracts/visual`](/agent-contracts/visuals); this page is how a thread draws them.

Nothing is drawn until the host sets [`visuals`](/agents-react/guide/host#visuals). With it left `null`, a thread has no visual rows at all.

## Where a visual goes

The chat client keeps a chat's visuals in its `ChatState` (`visuals`), from the attach and from every `chat.visuals` event. A visual has no item in the thread, so the timeline places it by its `at`, the way it places an app's thread cards: right before the first row that began after it. In a settled turn it lands under the fold, above the answer that closed the turn; in a running turn it stands between the calls around it, and always above the working row. Among a visual and a card of the same moment, the visual comes first. While the thread holds only its newest page, a visual from before that page waits until the page comes in.

```ts
import { timedRowsOf, withTimedRows } from '@adecore/agents-react/chat/logic/thread-cards';

const rows = withTimedRows(threadRows, timedRowsOf(cards, visuals, heldFrom));
```

`withTimedRows(rows, timed)` puts `TimedRow`s (`{ at, row }`) among the rows and answers the same array when there are none. `cardRows(cards)` and `visualRows(visuals, heldFrom?)` make them; `timedRowsOf(cards, visuals, heldFrom)` makes both, with `null` for a host that draws no visuals. `withThreadCards(rows, cards)` is the same merge for cards alone. A visual row is `{ kind: 'visual', id, visual }`, a block in the rhythm of the thread, and its turn is the one that published it.

## The row

`VisualRow` draws one visual inside an `ErrorBoundary`. Over the page's top right corner sit an expand button and a menu with Remove, shown while the pointer or the focus is on the visual and always on a touch screen. A click in the page never reaches the thread's context menu, so these are the visual's only controls.

`VisualDialogs` draws the large view, a dialog titled with the visual's title and a second frame of the page that fills it, and the question before a removal. The timeline draws it once per thread rather than in the row, since a row that scrolls out of view unmounts. `useVisualDialog` holds which visual of the window has either open. A removal deletes the page for good through `chat.removeVisual`.

## The frame

`VisualFrame` (`VisualFrameProps`: `chatId`, `visual`, `fill?`, `className?`) loads the host's `frameUrl` with the theme as a fragment, in `<iframe sandbox="allow-scripts allow-forms">` with the visual's title and `loading="lazy"`. Without `allow-same-origin` the page runs on an opaque origin, wherever the host page is served. It keeps that first address for its life, so a theme change never loads the page again.

`VisualBridge` does the talking, over the frame's window (`VisualFrameWindow`), with `VisualBridgeOptions` for what it reads and reports. It answers only the frame's own window:

- When the sandbox host page says it listens, it sends the page, read through the host's `attachments.read` and decoded as UTF-8, and the theme of now right after it.
- Inline rows reserve the full reported content height. A sticky frame stays within the full chat scrollport height, including the content behind a translucent composer, and follows the timeline position through `setViewport`. The stored `maxHeight` remains a compatibility limit for clients without this viewport mode.
- It opens a link the page asks for only while the frame has the focus and a person's activation is live, through the host's `openLink`, and answers the request either way. A page that takes the focus by script can still open a link; the check stops links opened as a page loads.
- When the frame loaded and the host page said nothing within a few seconds, or the page cannot be read, the frame says it could not load the visual, in the same box.

The row starts at the last content height reported for the same width, then the host's full measurements, then a modest default. `initialVisualContentHeight` and `rememberVisualHeight` retain that height across virtualized row mounts. `initialVisualHeight` and `clampVisualHeight` retain the capped behavior for older hosts.

Visual rows use `top` for their virtualized position: translating an ancestor would shift the sticky frame after the browser resolved its position.

`VisualViewportController` synchronizes the iframe without React updates on scroll. The chat scroll position is authoritative; the frame receives an absolute content offset. Wheel, navigation keys and touch gestures over the document request timeline movement, while scrollable controls inside a mockup retain native scrolling. Focus and fragment navigation inside the document also update the timeline. The host installs this runtime after loading the stored page, so older visuals participate without being rewritten. The frame's sandbox stays opaque.

A `fill` frame in the expanded dialog keeps its native document scrolling. Outside a chat scrollport, an inline frame takes its full content height. A bounded viewport does not unload DOM, chart data or animation work inside the visual; expensive pages still need their own lazy rendering.

Until the page runs, the frame's `color-scheme` is that of the host page, which declares none, and from then on the page's appearance: a frame whose color scheme differs from its document's paints an opaque ground behind it.

Run `bun run --cwd packages/agents-react test:visuals` to check the real React frame and sandbox in headless Chrome, including timeline scrolling, nested mockup scrolling, keys, touch, changing heights and the expanded view. This integration test requires a local Chrome installation.

## The theme

`useVisualTheme(ref)` builds the page's theme from the app's tokens where the frame stands, again whenever the app turns light or dark or the document root changes its `data-theme`, `class` or `style`, and every mounted frame follows it live. `visualThemeOf(tokens, appearance, background)` is the mapping, over `VisualTokens`:

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

Colors come out as the engine computes them, so a page's script can parse them. A token the app does not set leaves the page's default for that appearance, and so do `--warning-foreground` and `--info-foreground`, which have no token. `backgroundBehind(layers)` takes the computed backgrounds from the frame outward and answers the first ground that paints, with every translucent one in front of it laid over it.

The theme of the package defines `--chart-1` as the accent and `--chart-2` to `--chart-6` as a categorical series for both grounds, checked for color vision deficiency: orange, aqua, yellow, magenta and green.
