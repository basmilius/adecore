# Visuals

A visual is a self-contained HTML page an agent publishes in a chat: a chart, a table, a diagram, a collage of images, a mockup. A client shows it in the thread above the agent's reply, in a sandboxed frame on an opaque origin, drawn in the app's theme. The page talks to the app over a small JSON-RPC 2.0 bridge on `postMessage`, whose method names follow the MCP Apps extension, so the same frame can later show an app a server ships.

```ts
import { ChatVisualSchema, injectVisualBootstrap, parseVisualMessage, visualFrameHeight } from '@adecore/agent-contracts/visual';
```

A visual belongs to its chat. It goes when the chat is deleted or cleared, a person can remove it from its card, and a fork gets a copy with pages of its own. [`@adecore/agents`](/agents/chats#visuals) keeps them.

## The record

`ChatVisualSchema` is `{ id, title, at, maxHeight, heights?, size, turnId? }`, `ChatVisual` its type and `ChatVisualsSchema` a list of them.

| Field       |                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| `id`        | Also the attachment id of the stored page, so a client reads its bytes the way it reads any attachment.        |
| `title`     | What the page shows, in a few words.                                                                            |
| `at`        | When it was published, in milliseconds on the host's clock, the one an item's `createdAt` uses. It places the visual among the items. |
| `maxHeight` | The tallest the frame may grow, in CSS pixels.                                                                  |
| `heights`   | `[width, height]` pairs in CSS pixels, ascending by width (`VisualHeightSchema`, `VisualHeight`). Absent when nobody measured the page. |
| `size`      | Bytes of the stored page.                                                                                       |
| `turnId`    | The turn that published it, when one was running.                                                               |

`VISUAL_LIMITS` holds what a host accepts at publish: a title of at most 200 characters, a height from 80 to 2000 CSS pixels (2000 when the agent names none), a stored page of at most 16 MiB and at most 24 measured heights. The schema checks shapes only, so a host that widens a limit never makes an older client refuse a whole attach. `VISUAL_MEASURE_WIDTHS` are the frame widths a host may measure a page at, ascending from 320 to 1200.

`visualFrameHeight(visual, width)` answers the height of a frame that wide from the measurements: the taller of the two at the nearest measured widths on either side, since a breakpoint between them can make the page as tall as either. It caps that at `maxHeight`, keeps it within the limits in whole pixels, and answers `undefined` when there are no heights. A frame then follows the size the page reports.

## On the wire

| Shape                                                    |                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `ChatAttachResultSchema`                                 | An optional `visuals`: the chat's whole list. Absent from a host that keeps none. |
| `chat.visuals`, `ChatVisualsEventSchema`, `ChatVisualsEvent` | `{ chatId, visuals }`, the whole list after every change, to every client attached to the chat. |
| `chat.removeVisual`, `ChatRemoveVisualPayloadSchema`, `ChatRemoveVisualPayload` | `{ chatId, visualId }`. A visual that is already gone is no refusal. |
| `ChatVisualsResultSchema`, `ChatVisualsResult`           | `{ visuals }`, what `chat.removeVisual` answers.                                |

Nothing about visuals is a chat item, so a client that validates `chat.attach` and `chat.history` whole reads a thread with visuals as it did before.

## The bridge

`VISUAL_BRIDGE_METHODS` names the five messages. The frame loads a small sandbox host page the app serves ([`VISUAL_HOST_PAGE`](#serving-a-page)); that page writes the visual's document into itself with `document.open`, `write` and `close`.

| Method                                   | From, to                    | Builder                         |
| ---------------------------------------- | --------------------------- | ------------------------------- |
| `ui/notifications/sandbox-proxy-ready`   | Sandbox host page to app     | `visualProxyReadyMessage()`     |
| `ui/notifications/sandbox-resource-ready`| App to sandbox host page     | `visualResourceReadyMessage(html)` |
| `ui/notifications/host-context-changed`  | App to page                  | `visualHostContextMessage(theme)` |
| `ui/notifications/size-changed`          | Page to app                  | `visualSizeChangedMessage({ width, height })` |
| `ui/open-link`                           | Page to app, a request       | `visualOpenLinkRequest(id, url)` |

The app answers an open-link request with `visualOpenLinkResult(id)`, an empty result, whether it opened the link or not. `parseVisualMessage(data)` reads anything that arrives on `message` and answers a `VisualMessage`, a union on `method`, or `undefined` for anything else. It ignores fields it does not know, takes a size without a width, and takes a link only when it is an absolute http or https URL on a request with an id (`VisualRequestId`).

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

## The theme

A page is drawn with the CSS custom properties in `VISUAL_THEME_VARIABLES` (`VisualThemeVariable`), the names models already know from widespread component themes: `--background`, which is exactly what lies behind the frame, `--foreground`, the surfaces and their foregrounds, `--border`, `--input`, `--ring`, the states `--destructive`, `--warning`, `--success` and `--info`, `--code-background` and `--code-foreground`, a categorical series `--chart-1` to `--chart-6`, `--radius`, `--font-sans` and `--font-mono`.

A `VisualTheme` is `{ appearance, variables }`, with `VisualAppearance` `light` or `dark`. `VISUAL_LIGHT_THEME` and `VISUAL_DARK_THEME` are neutral palettes without an accent, for a page that gets no theme from its host; a host passes its own tokens. `cleanVisualVariables(input)` keeps the names that match `--[a-z0-9-]+` and the values that cannot break out of their rule.

`visualThemeFragment(theme)` writes a theme into a URL fragment, one URI-encoded JSON key, for the address of the sandbox host page. The page applies it before its first paint and takes it off the address, so a page's own hash routing never sees it. After that, `visualHostContextMessage(theme)` changes the theme live.

## The bootstrap

`injectVisualBootstrap(html)` puts what every page needs at the very start of its head, and a host writes the result to disk once, at publish:

- `<meta charset="utf-8">`, and a viewport when the page sets none of its own;
- a style element with the default theme (dark, with the light palette under `prefers-color-scheme: light`) and a base stylesheet: the background, color and font of the root from the variables, `14px` type, no margin on the body and no scrollbar of the page's own;
- a script that applies a theme from the fragment or from a host context message by rewriting that style element, so a page's own later `:root` rules still win; reports the size of the root element as `ui/notifications/size-changed`, at most once per animation frame and only when it changed; and asks the app to open a trusted click on a link to another http or https document. A document that is not in a frame instead opens such a link in a new browsing context.

Only comments, a doctype and the html start tag may come before the head it looks for, so a `<head>` in a comment, in the text of a script or in a template never receives the bootstrap. A page without a head gets one. The script reads every message leniently, since a page written today meets newer hosts.

## Telling an agent

Three short texts, product-neutral, for a host's tool or command help: `VISUAL_PAGE_RULES` (one self-contained document, public http(s) URLs load as they are, inline SVG or a canvas where it does), `VISUAL_LAYOUT_GUIDE` (a borderless frame as wide as the reply column, fluid width, no outer card or banner title, charts at a fixed height) and `VISUAL_THEME_GUIDE` (the variables, and that they follow light and dark live).

## Serving a page

A page's bytes are an attachment with the mime type `text/html`. Never let one render on the app's own origin: serve `text/html` attachments as a download, or with `Content-Security-Policy: sandbox allow-scripts allow-forms`, and hand a frame the page only through the sandbox host page.

`VISUAL_HOST_PAGE` is that sandbox host page: a UTF-8 HTML document with one inline script and nothing else. Serve it from code as `text/html; charset=utf-8`, with its policy as a header, since it carries none. In a frame it posts `ui/notifications/sandbox-proxy-ready` to its parent, writes the first `ui/notifications/sandbox-resource-ready` from its parent into itself and ignores every message after that, and every message from anyone else. Opened on its own, it does nothing.

A frame that shows it is `sandbox="allow-scripts allow-forms"`, never with `allow-same-origin`, `allow-popups` or `allow-top-navigation`: the page runs on an opaque origin, opens no window and never moves the app. [`@adecore/agents-react`](/agents-react/chat/visuals) draws such frames. Without `allow-same-origin`, the address the host page came from grants the page nothing, so the host page can live in either of two places:

- On an origin other than the app's.
- On a path of the app's own origin, which works the same in a dev server, a desktop shell and a web build. Its `Content-Security-Policy` then adds `sandbox allow-scripts allow-forms`, so the document has an opaque origin even when something loads it without the frame's attribute. It also limits `frame-ancestors` to the app, so no other site can frame it and hand it a page.

The page runs in that same document, so the policy the host page was served with is the page's policy as well. It has to allow inline scripts and styles, and whatever a page may load, such as public `https:` sources. The app's own policy has to let it frame the host page: its `frame-src`, or what that falls back to, names the host page's origin, or `'self'` when the host page is on the app's own.
