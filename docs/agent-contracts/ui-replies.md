# UI blocks in replies

An agent can answer with a block of components, written in the language of [`@adecore/intelligent-ui`](/intelligent-ui/). This page covers the fields and requests the chat protocol adds for those blocks: the compiled blocks on an assistant item, the choice a person picks, and the live readings and links a host resolves. [Getting started with Intelligent UI](/intelligent-ui/getting-started#the-wire) shows them wired end to end.

## Blocks on an assistant item

An assistant item may carry `ui`, an array of UI block envelopes from `@adecore/intelligent-ui/protocol`. Each block carries its catalog version, a stable ID, its source range, its diagnostics and a Markdown fallback. An unknown component or catalog version leaves the rest of the history valid.

While a reply streams, a block preview rides on a `delta` with an empty `text`, an optional `ui` and `textLength`. It has no `seq`, stays out of the log and reaches only attached clients. Apply it only while the assistant item still streams and has that length. The final assistant item carries the tree that counts.

## Choices

`ChatUiChoicePayloadSchema` and `ChatUiChoicePayload` are the `chat.uiChoice` request: the chat, assistant item, block, revision and choice ids, plus optional local input `values`. Its result is a `ChatSendResult`. The client never sends a label or message context. The host reads both from the stored block and checks the choice against the block's revision.

`ChatUiChoiceOriginSchema` and `ChatUiChoiceOrigin` record on a user item or queued message where a choice came from. The assistant's optional `uiAnswers` map holds `ChatUiAnswerSchema` / `ChatUiAnswer` records with the answer's turn id and whether it queued. Picking the same choice again returns that turn. Another choice in that block is refused.

## Live queries, links and places

`ChatUiQueryPayloadSchema` and `ChatUiQueryPayload` are `ui.query`: chat, item, block, revision, the stored query's name, and optional local input values. A client never sends a source, SQL or fixed arguments.

`ChatUiQueryReadingSchema` and `ChatUiQueryReading` carry a fresh value with an opaque read id, or a failed or refused reading with its reason, an optional stable `code` and its time. The `state` values of readings and link resolutions are a closed set. `code` is any string. `ChatUiQueryStateSchema` and `ChatUiQueryState` sit on an assistant item. They keep the writer's chat, and each block's first reading with its frozen fallback. A choice can name the read ids it showed, and the host fills in those values after checking access again.

`ChatUiLinkPayloadSchema` and `ChatUiLinkPayload` name a stored node for `ui.link`, with the block, local inputs and host-issued read ids. `ChatUiLinkReadingSchema` and `ChatUiLinkReading` say where the link goes, or why it stays plain text. Every open resolves the node and checks access again. `ChatUiPlaceReadingSchema` and `ChatUiPlaceReading` hold the point a host found for a `Place`, in a frozen block's optional `places` by node id, with its `address`. `state` is `found` or `missing`.
