# Intelligent UI renderers

An agent can answer with a block of components from the catalog of [`@adecore/intelligent-ui`](/intelligent-ui/): a summary, a table, a checklist, choices. That package compiles and evaluates the block; the renderers here draw the evaluated nodes. They are presentational. A renderer never sees an expression, a `$variable` or a query, never sends a message and never reads a path or an address the model wrote. What a block may do outside itself goes through callbacks the host passes in, and a renderer without them draws the quiet version.

`UiReply` interleaves compiled blocks with surrounding Markdown in the assistant row. It evaluates nodes, keeps local input state by scope/chat/item/block for the life of the page, wraps each node in its own error boundary and supplies rendered children through `UI_RENDERERS`. Prose and cards stand a block gap apart (`--chat-block-gap`). Text the agent wrote in a block is inline Markdown: emphasis, inline code and links, which open only through `openUrl` and only for `http` or `https`. Headings, lists, quotes, fences, images and raw HTML stay text, and so does the value of an expression, a CodeBlock and the label of a control or a Tag. Where a block, a Tab or a Section stacks its children, a run of text, tags and bare link chips is one paragraph. `uiReplyParts` returns `UiReplyPart` text/block entries, validates text ranges and omits the growing raw tail of an unfinished block. Unknown catalog versions show their Markdown fallback. Choices call the optional `ChatHost.intelligentUi.sendChoice(scopeId, payload)`, which resolves with `sent` or `queued`; without it they remain disabled. The payload contains stored item/block/revision/choice identities and bound local input values. `UiReply.answers` supplies persisted `ChatUiAnswer` records: the selected values survive reload, the footer shows the label and time, and every input and choice closes once answered. Live queries still need their adapter. The demo below draws a fixed tree the same way.

<Demo src="agents/intelligent-ui" />

## The interface

```tsx
import { UI_RENDERERS } from '@adecore/agents-react/chat/ui/intelligent-ui/registry';
import type { UiRendererProps, UiRenderer } from '@adecore/agents-react/chat/ui/intelligent-ui/render-context';

const renderer = UI_RENDERERS[node.type];
const element = renderer === null ? null : createElement(renderer, { node, context }, children);
```

`UiRendererProps<Props>` is `{ node, children, context }`: the evaluated `UiViewNode` of one component, with its own children still on it as metadata, the rendered children in order, and the `UiRenderContext` of the block. `UiRenderer<Props>` is a component of those props, and `UiRenderers` maps every component name of the catalog to one, or to `null`. `UI_RENDERERS` is typed as `UiRenderers`, so a component added to the catalog fails the typecheck until it has an entry.

Four entries are `null`. `Show` and `Each` are resolved by the evaluation before anything renders. `Column` and `Option` are metadata: a table reads its columns from its node, and `Segmented` reads its segments, so neither draws anything of its own. Every other renderer is a named component: `SummaryRenderer`, `CalloutRenderer`, `TagRenderer`, `ProgressRenderer`, `StepsRenderer`, `StepRenderer`, `StatsRenderer`, `StatRenderer`, `EntityListRenderer`, `EntryRenderer`, `TableRenderer`, `ChartRenderer`, `TabsRenderer`, `TabRenderer`, `SectionsRenderer`, `SectionRenderer`, `CodeBlockRenderer`, `ImageRenderer`, `SourcesRenderer`, `SourceRenderer`, `FileRenderer`, `DiffRenderer`, `CommitRenderer`, `NodeRenderer`, `ChecklistRenderer`, `ItemRenderer`, `SwitchRenderer`, `SliderRenderer`, `SegmentedRenderer`, `ChoicesRenderer` and `ChoiceRenderer`.

### The context

`UiRenderContext` carries `scopeId`, `chatId`, `itemId` and `blockId`, the `phase` of the block (`streaming` or `final`) and its `answer`: null while it is open, or a `UiAnswer` (`choiceId`, and `state` as `sending`, `sent` or `queued`). The optional fields:

| Field            | What a renderer does with it                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `failedChoiceId` | The Choice whose last send failed. The block is open again and that row says it could not send.             |
| `live`           | A `UiLiveStatus` while the block reads live data. A running step spins only while the block streams or is live. |
| `link(target)`   | Answers a `UiLink`: `state` as `chip` or `plain`, with the host's `label` and, for plain text, a `reason`.  |
| `openLink(target)` | Opens a chip. Without it a chip is drawn but does nothing.                                                 |
| `openUrl(url)`   | Opens a source. Without it a source is a row that cannot be opened.                                          |
| `onChoose(nodeId)` | Called with the id of a Choice a person picked. Without it every choice stays closed.                     |

`UiLinkTarget` names a resource by the component that names it: `{ type: 'File', path, line? }`, `{ type: 'Diff', path }`, `{ type: 'Commit', sha }` or `{ type: 'Node', id }`. The host checks a target again when it acts, and it answers `plain` until it has checked it, so a link reads as text while a block streams and fades into a chip once the host knows.

`UiLiveStatus` holds `state` (`fresh`, `reading`, `failed` or `refused`), the `sources` it reads, `readAt` in milliseconds since the epoch or null, and for a failure the `source` and the `reason`.

## The frame

`UiBlockFrame` is the card of one block, controlled through `UiBlockFrameProps`: the evaluated top-level `nodes`, the `phase`, the rendered `children` and the props of its footer. It is a group named by the Summary that heads it, or by the words for an interactive block, and busy while it streams; it is never a live region. A node fades in as it arrives and rises 2px, only fading for a person who prefers less motion; a node that lands inside another only fades, through `chat-ui-nodes` in the theme. While a block streams the card grows and never shrinks; once the phase is final it eases down to its own height in 200ms, at once for a person who prefers less motion. Before the first node a skeleton line holds the place of the head.

`UiHeadContext` is how a Summary knows it heads the block: the frame provides the id of the first node when it is a Summary, which `uiBlockHead(nodes)` finds, together with its text. A later Summary is a subheading without an icon. Outside a frame every Summary heads.

`UiBlockFooter` is the line under the card, drawn only when there is something to say, in this order: the live status, the answer (`answered`, a label and a time), the repairs (`fixes`, a list of `UiBlockFix` with a `code` and a `message`, folded) and `shownAsText` with the reason a whole block is drawn as its text. `UiBlockFooterProps` lists them.

`UiFallbackPart` draws one part as the markdown it stands for, with a quiet line above it. `UiFallbackProblem` says which line: `{ kind: 'unknown', component }` for a component this version cannot draw, `{ kind: 'failed' }` for one it could not draw. A table or a chart without usable data draws its own fallback this way.

## The components

Text and status. A Summary takes a tone icon and its badge as a tag. A Callout is a surface of its tone, never a colored edge. A Tag is a small pill. Progress reads `312 of 500`, or a percentage without a max, and is indeterminate without a value. Steps are rows of 28px, an icon per state; pending and skipped are faint.

Data. Stats are tiles in a grid; with a previous value a line gives the arrow, the change in percent and the old value, colored only when the agent gave a tone. An EntityList draws a hairline from seven entries on. A table scrolls inside 320px under a sticky head, numbers aligned to the right, and shows fifty rows until a person asks for all of them. `uiTableColumns(node)` decides its columns: the Column children whose key some row has, or the keys of the rows themselves. `uiTableCell(value, column)` decides each cell as a `UiTableCell` before anything formats it, so a value of the wrong kind reads as text and a missing one as nothing. A duration is in milliseconds; a date is milliseconds since the epoch or an ISO string. `UiTableColumn`, `UiColumnKind`, `isNumericColumn` and `UI_TABLE_ROWS` are the parts.

A chart draws only once its node closed. Until then a quiet surface of its final height holds its place: 160px, or 24px a row for `hbar`. `uiChartData(data, kind)` keeps up to `UI_CHART_SERIES` numeric series over at most `UI_CHART_ROWS` rows and returns a `UiChartData` of `UiChartSeries`, with a gap for a value that is no finite number, or null when nothing can be drawn. `niceCeiling` rounds the top of the axis. The series take `--chart-1`, the accent, to `--chart-6`, with a legend only for more than one. A chart is an image with one sentence for a screen reader and a hidden table of its values, and it grows in once, not at all for a person who prefers less motion.

Structure. Tabs keep the tab a person opened while new ones arrive. Sections arrive open until a person folds one, after which nothing opens by itself. `useBlockLocal(context, nodeId, initial)` keeps both for the life of the page, so a block the thread unmounts while scrolling comes back as it was left.

Content. A CodeBlock is the code of the thread, highlighted once its node closed. An Image is an attachment of the chat through the host's `attachments.useUrl`; an image of the latest generation is a quiet square until the daemon resolved it to an attachment. Sources are numbered rows that open through the host and load nothing before.

Links. `UiLinkChip` draws a target as the chip a mention has in a message, or as mono text with the reason in a tooltip. With children a link is a row: the chip and what the agent says about it.

Inputs change only local state, through `node.bindings.value.onValueChange`, and only once their own node closed; before that they stand at 60% and take no pointer. A node without a binding is read only and stays disabled. A checklist row is the label as a whole, while a link inside it keeps its own click.

Choices. A Choice is a row with its label and, under it, the context the agent receives, fully read through `aria-describedby`. It is closed while the reply streams, once the block is answered, when the agent disabled it and without `onChoose`, and stays focusable so the reason is heard. The chosen row says Sent or Queued; a send that takes over 300ms shows a spinner, which `useLater` times. When a streamed block opens its choices a screen reader hears it once. A primary choice stands first.

## Tones and words

`UI_TONE_ICONS`, `UI_TONE_TEXT`, `UI_TONE_SURFACE` and `UI_TONE_PILL` map the five tones to an icon, a text color, a surface and a pill. Every tone has its own icon, so color is never the only signal. `uiNodeText(node)` joins the text under a node as written, `uiNodeLabel(node)` puts it on one line for a name a control needs, and `uiChildrenOf(node, type)` lists the valid children of one kind.

The words are in the `agent-chat` namespace under `blocks`, in English and Dutch. What the agent writes is never translated.

## Live readings

`useUiQueries` connects a block to `ChatHost.intelligentUi.query`, using only its stored identity, query name and local input values. `UiReply.queries` supplies the frozen first readings from the assistant item. Successful reads update `UiState`; failed reads retain the previous values and give `UiBlockFooter` their reason. Intersection and document visibility pause refresh while the block is out of view or the app is hidden. A visible block refreshes at most once every ten seconds. Choices send opaque read ids alongside their input values so the daemon can validate the values the person saw.

`useUiLinks` supplies `UiRenderContext.link` from initial resolutions and the host's `intelligentUi.link` request. It reads only visible supported targets, refreshes when inputs or query readings change, and rechecks the stored node on every click before calling `intelligentUi.openLink`. `intelligentUi.openUrl` opens HTTP and HTTPS sources without preloading them. A host that leaves out these callbacks keeps links as text.

Local input state is retained for the 64 most recently mounted blocks. Mounted blocks keep their own state even after leaving that cache; reopening an evicted block starts with its defaults or saved answer.


A choice heading in `Timeline` jumps to its original item, block and revision. It loads earlier pages and opens a folded turn before scrolling to and focusing the block. Only that block flashes; a missing or changed revision receives no jump. `UiReplyNavigationContext` supplies this navigation to `UserRow` and `UiReply`. Standalone rows keep a plain heading when the context is absent.
