# Intelligent UI renderers

An agent can answer with a block of components: a summary, a table, a checklist, choices. [`@adecore/intelligent-ui`](/intelligent-ui/) compiles and evaluates the block; the renderers here draw it. The [language](/intelligent-ui/language/syntax), the [components](/intelligent-ui/components/status) and the [host integration](/intelligent-ui/guide/getting-started) have their own pages.

<Demo src="agents/intelligent-ui" />

## Drawing a reply

The assistant row draws a reply with UI blocks through `UiReply`. `uiReplyParts` splits the text, so prose stays Markdown and each block becomes a card.

```tsx
import { UiReply } from '@adecore/agents-react/chat/ui';

<UiReply
    text={item.text}
    blocks={item.ui}
    context={{ scopeId, chatId, itemId: item.id, phase: item.streaming ? 'streaming' : 'final' }}
    answers={item.uiAnswers}
    queries={item.uiQueries}
/>;
```

`answers` holds the persisted `ChatUiAnswer` records; an answered block shows its choice and closes its inputs. `queries` holds the first readings of a live block. Input state lasts for the page's lifetime.

## What the host supplies

A renderer never sends a message, reads a path or opens an address itself. Everything a block does outside itself goes through `ChatHost.intelligentUi`. Leave a callback out and that part stays quiet.

| Callback | Without it |
| --- | --- |
| `sendChoice(scopeId, payload)` | Required. Resolves with `sent` or `queued`. |
| `query(scopeId, payload)` | A live block shows its frozen reading and does not refresh. |
| `link(scopeId, payload)` | File, Diff, Commit and Node links stay text. |
| `openLink(scopeId, reading)` | A link chip draws but does nothing. |
| `openUrl(scopeId, url)` | A source cannot be opened. |
| `subscribe(scopeId, chatId, changed)` | Visible blocks only refresh on their own interval. |

## Maps

A `Map` reads its tiles from `ChatHost.maps.useSource(scopeId)`, which returns a `UiMapSource`. The host owns the tile service, its key and its access checks.

| Source | Fields |
| --- | --- |
| `{ state: 'tiles' }` | `styleUrl(theme)` returns the style document for `light` or `dark`. `transformRequest(url)` may add a ticket to a request's address or `headers`; return any other origin's `url` untouched, so the ticket stays with your service. `labelField(language)` names the feature property with labels in that language. `attribution` is drawn under the map. |
| `{ state: 'off' }` | `reason` is `disabled`, `signed-out` or `unavailable`, shown under the map. |

Without `maps`, or when tiles fail or the page is offline, a map draws a built-in world outline and says why. The list of places is always drawn, for screen readers too.

MapLibre GL JS (`maplibre-gl` 6, BSD-3-Clause) draws the map in a lazy chunk of about 300 kB gzipped plus a worker. Each map holds a WebGL context, so at most `MAX_LIVE_MAPS` draw at once; another waits behind a Show map button.

Set `ChatHost.maps.workerUrl`, since the Vite dev server's pre-bundle breaks the package's own worker address. Write it in your app, with `maplibre-gl` as a dependency:

```ts
const workerUrl = new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href;
```

A checkout linked through the `source` condition needs no `workerUrl`. A Content Security Policy needs `worker-src` for the page's origin (`blob:` for a worker from another origin), `img-src` and `connect-src` for the tile service, and `data:` images. It needs no `'unsafe-eval'`.

Markers are numbered like the list, and clicking one picks its place. The map ignores the wheel and one finger until Ctrl or Command is held or two fingers are used. The tokens `--map-land` and `--map-water` paint the outline, `--map-marker` and `--map-marker-text` the numbers; see [Places](/intelligent-ui/components/places).

A visible block refreshes its live data on an interval and shortly after an input changes. Choices stay closed until the reading matches the inputs on screen. [Live queries](/intelligent-ui/host/queries) and [links](/intelligent-ui/host/links) cover the backend side.

## Models

A `Model` draws through `ChatHost.ModelView`, a component that gets `UiModelViewProps`. The host picks the 3D viewer and reads the file.

| Prop | What it is |
| --- | --- |
| `scopeId`, `chatId` | The chat the block is in. |
| `attachmentId` | The attachment the block names. |
| `url` | The attachment's bytes, as `attachments.useUrl` resolved them. |
| `label` | What the model shows, for a screen reader: the block's `alt`, its caption, or a word for a 3D model. |
| `alt` | The block's `alt`, when it gave one. |
| `caption` | The caption as plain text, empty without one. |

The view fills a 320px frame across the reply column, with the caption under it; draw no caption of your own. A view that throws shows a message in its frame. Without `ModelView` or the attachment, the model is a row with its alt text and caption.

## Custom renderers

`UI_RENDERERS` maps every catalog component to a renderer. Its type `UiRenderers` fails the typecheck for a catalog component without an entry. `Show`, `Each`, `Column` and `Option` map to `null`, since their parents handle them.

```tsx
import { UI_RENDERERS } from '@adecore/agents-react/chat/ui';

const renderer = UI_RENDERERS[node.type];
const element = renderer === null ? null : createElement(renderer, { node, context }, children);
```

A renderer gets `UiRendererProps`: the evaluated `UiViewNode`, its rendered `children` and the block's `UiRenderContext`. The context has the block's `phase` (`streaming` or `final`), its `answer`, and the host callbacks as `link`, `openLink`, `openUrl` and `onChoose`. An input changes state only through `node.bindings.value.onValueChange`, a Button only through `node.onAction()`.

`UiBlockFrame` is the card around a block, with a footer for live status, the answer and compiler notes. A part this version cannot draw shows as its Markdown. The [reference](/agents-react/reference#intelligent-ui) lists every module and its exports.

## Words and accessibility

The words live in the `agent-chat` namespace under `blocks`, in English and Dutch. `uiReasonText` translates a host reason code, falling back to the host's sentence.

Every tone has its own icon, so color never carries meaning alone. A card is a named group, not a live region. A chart is an image with a one-sentence summary and a hidden table of its values. Motion follows the reduced-motion setting.
