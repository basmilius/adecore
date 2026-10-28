# Visuals

A visual is a self-contained HTML page an agent publishes in a chat, such as a chart, table, diagram or mockup. A client shows it above the agent's reply in a sandboxed frame on an opaque origin, in the app's theme. The page talks to the app over a JSON-RPC 2.0 bridge on `postMessage`. Its base methods follow the MCP Apps extension.

```ts
import { ChatVisualSchema, injectVisualBootstrap, parseVisualMessage, visualFrameHeight } from '@adecore/agent-contracts/visual';
```

A visual belongs to its chat. Deleting or clearing the chat removes it, a person can remove it from its card, and a fork gets its own copy. [`@adecore/agents`](/agents/chats#visuals) stores them.

## The record

`ChatVisualSchema` is `{ id, title, at, maxHeight, layout?, heights?, size, turnId? }`, `ChatVisual` its type and `ChatVisualsSchema` a list of them.

| Field       |                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| `id`        | Also the attachment id of the stored page, so a client reads it like any attachment.                           |
| `title`     | What the page shows, in a few words.                                                                            |
| `at`        | Publish time in milliseconds on the host's clock (as `createdAt`). It places the visual among the items.       |
| `maxHeight` | The height limit in CSS pixels for clients without a synchronized viewport.                                     |
| `layout`    | A `VisualLayout` (`VisualLayoutSchema`). `inline` (default) follows the reply column, `wide` uses the chat pane width. |
| `heights`   | `[width, height]` pairs in CSS pixels, ascending by width (`VisualHeightSchema`, `VisualHeight`). Absent when unmeasured. |
| `size`      | Bytes of the stored page.                                                                                       |
| `turnId`    | The turn that published it, when one was running.                                                               |

`VISUAL_LIMITS` holds what a host accepts at publish (title length, height range, page size, measured heights). The schema checks shapes only, so a host may widen a limit. `VISUAL_MEASURE_WIDTHS` are the frame widths a host may measure a page at.

`visualFrameHeight(visual, width)` returns a frame height for that width from the measurements, capped at `maxHeight`, or `undefined` without heights. A frame then follows the size the page reports.

## On the wire

| Shape                                                    |                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `ChatAttachResultSchema`                                 | An optional `visuals`: the chat's whole list. Absent from a host that keeps none. |
| `chat.visuals`, `ChatVisualsEventSchema`, `ChatVisualsEvent` | `{ chatId, visuals }`, the whole list after every change, to every client attached to the chat. |
| `chat.removeVisual`, `ChatRemoveVisualPayloadSchema`, `ChatRemoveVisualPayload` | `{ chatId, visualId }`. Removing a missing visual is no refusal. |
| `ChatVisualsResultSchema`, `ChatVisualsResult`           | `{ visuals }`, what `chat.removeVisual` returns.                                |

Visuals are no chat items, so clients that validate a whole thread are unaffected.

## The bridge

`VISUAL_BRIDGE_METHODS` names the base messages and the viewport extensions. The frame loads a sandbox host page the app serves ([`VISUAL_HOST_PAGE`](#serving-a-page)), which writes the visual's document into itself.

| Method                                   | From, to                    | Builder                         |
| ---------------------------------------- | --------------------------- | ------------------------------- |
| `ui/notifications/sandbox-proxy-ready`   | Sandbox host page to app     | `visualProxyReadyMessage()`     |
| `ui/notifications/sandbox-resource-ready`| App to sandbox host page     | `visualResourceReadyMessage(html)` |
| `ui/notifications/host-context-changed`  | App to page                  | `visualHostContextMessage(theme)` |
| `ui/notifications/size-changed`          | Page to app                  | `visualSizeChangedMessage({ width, height })` |
| `ui/open-link`                           | Page to app, a request       | `visualOpenLinkRequest(id, url)` |
| `adecore/visual/viewport-ready` | Host runtime to app | Sent after the runtime is installed |
| `adecore/visual/viewport-changed` | App to host runtime | `visualViewportMessage(viewport)` |
| `adecore/visual/scroll-request` | Host runtime to app | `visualScrollMessage(request)` |

The app answers an open-link request with `visualOpenLinkResult(id)`, an empty result, whether it opened the link or not. `parseVisualMessage(data)` returns a `VisualMessage` (a union on `method`) or `undefined`. It accepts a link only as an absolute http or https URL on a request with an id (`VisualRequestId`).

```ts
window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) {
        return;
    }
    const message = parseVisualMessage(event.data);
    if (message?.method === 'ui/open-link') {
        openInBrowser(message.url);
        frame.contentWindow.postMessage(visualOpenLinkResult(message.id), '*');
    }
});
```

`VisualViewport` is `{ top, height }` in CSS pixels. A non-null viewport makes the runtime follow that document offset and route scroll gestures to the parent. `null` restores native scrolling, as does sending no viewport at all. `VisualScrollRequest` carries `{ by }`, `{ to }` or `{ edge: 'start' | 'end' }`. A host must check `event.source`, accept scroll requests only in viewport mode, and ignore requests from offscreen rows. These extensions are not MCP Apps methods.

## The theme

A page uses the CSS custom properties in `VISUAL_THEME_VARIABLES` (`VisualThemeVariable`), names models know from common component themes: `--background` (exactly what lies behind the frame), `--foreground`, the surfaces and their foregrounds, `--border`, `--input`, `--ring`, `--destructive`, `--warning`, `--success`, `--info`, `--code-background`, `--code-foreground`, `--chart-1` to `--chart-6`, `--radius`, `--font-sans` and `--font-mono`.

A `VisualTheme` is `{ appearance, variables }`, with `VisualAppearance` `light` or `dark`. `VISUAL_LIGHT_THEME` and `VISUAL_DARK_THEME` are neutral fallback palettes without an accent. A host passes its own tokens. `cleanVisualVariables(input)` keeps only names matching `--[a-z0-9-]+` and values that cannot escape their rule.

`visualThemeFragment(theme)` encodes a theme into the URL fragment of the sandbox host page. The page applies it before first paint and removes it from the address. After that, `visualHostContextMessage(theme)` changes the theme live.

## The bootstrap

`injectVisualBootstrap(html)` prepends what every page needs to its head. A host runs it once, at publish:

- `<meta charset="utf-8">`, and a viewport when the page sets none.
- A style element with the default theme (dark, light under `prefers-color-scheme: light`) and a base stylesheet: root background, color and font from the variables, `14px` type, no body margin and no page scrollbar.
- A script that applies the theme from the fragment or host context messages, reports the root's size as `ui/notifications/size-changed`, and asks the app to open trusted clicks on http or https links. A page's own later `:root` rules still win.

A `<head>` inside a comment, script or template never receives the bootstrap. A page without a head gets one.

## Telling an agent

Three short product-neutral texts for a host's tool or command help: `VISUAL_PAGE_RULES` (one self-contained document, public http(s) URLs, inline SVG or canvas), `VISUAL_LAYOUT_GUIDE` (a borderless, fluid frame as wide as the reply column, no outer card or banner title, charts at a fixed height) and `VISUAL_THEME_GUIDE` (the variables, which follow light and dark live).

## Serving a page

A page's bytes are a `text/html` attachment. Never let one render on the app's own origin. Serve `text/html` attachments as a download or with `Content-Security-Policy: sandbox allow-scripts allow-forms`, and hand a frame the page only through the sandbox host page.

`VISUAL_HOST_PAGE` is that sandbox host page, a UTF-8 HTML document with one inline script. Serve it from code as `text/html; charset=utf-8`, with its policy as a header. In a frame it posts `ui/notifications/sandbox-proxy-ready` to its parent and writes the first `ui/notifications/sandbox-resource-ready` from its parent into itself. It ignores every later message and every message from anyone else.

The frame is `sandbox="allow-scripts allow-forms"`, never with `allow-same-origin`, `allow-popups` or `allow-top-navigation`. So the page runs on an opaque origin, opens no window and never navigates the app. [`@adecore/agents-react`](/agents-react/chat/visuals) draws such frames. The host page can live in one of two places:

- On an origin other than the app's.
- On a path of the app's own origin. Its `Content-Security-Policy` then adds `sandbox allow-scripts allow-forms`, so the document stays opaque even when loaded without the frame attribute. It also limits `frame-ancestors` to the app, so no other site can frame it and hand it a page.

The host page's policy is also the page's policy. It must allow inline scripts and styles, and whatever pages may load, such as public `https:` sources. The app's own `frame-src` (or its fallback) must name the host page's origin, or `'self'` when it lives on the app's origin.
