# UI blocks in replies

An agent can answer with a block of components, written in the language of [`@adecore/intelligent-ui`](/intelligent-ui/). This page covers the fields and requests the chat protocol adds for those blocks: the compiled blocks on an assistant item, the choice a person picks, and the live readings and links a host resolves. [Getting started with Intelligent UI](/intelligent-ui/getting-started#the-wire) shows them wired end to end.

## Blocks on an assistant item

An assistant item may carry `ui`, an array of UI block envelopes from `@adecore/intelligent-ui/protocol`. Each block carries its catalog version, a stable ID, its source range, its diagnostics and a Markdown fallback. An unknown component or catalog version leaves the rest of the history valid.

While a reply streams, a block preview rides on a `delta` with an empty `text`, an optional `ui` and `textLength`. It has no `seq`, stays out of the log and reaches only attached clients. Apply it only while the assistant item still streams and has that length. The final assistant item carries the tree that counts.

## Choices

`chat.uiChoice` takes a `ChatUiChoicePayload` (`ChatUiChoicePayloadSchema`): the chat, assistant item, block, revision and choice ids, plus optional local input `values`. It returns a `ChatSendResult`. The client never sends a label or message context. The host reads both from the stored block and checks the choice against the block's revision.

A user item or queued message records where its choice came from in a `ChatUiChoiceOrigin` (`ChatUiChoiceOriginSchema`). The assistant item's optional `uiAnswers` map holds a `ChatUiAnswer` (`ChatUiAnswerSchema`) per answered block, with the answer's turn id and whether it queued. Picking the same choice again returns that turn. The host refuses another choice in that block.

## Live queries, links and places

`ui.query` takes a `ChatUiQueryPayload` (`ChatUiQueryPayloadSchema`): chat, item, block, revision, the stored query's name, and optional local input values. A client never sends a source, SQL or fixed arguments.

It returns a `ChatUiQueryReading` (`ChatUiQueryReadingSchema`). A fresh reading carries the value and an opaque read id. A failed or refused one carries its reason and an optional stable `code`. Every reading carries its time. The `state` values of readings and link resolutions are a closed set, while `code` is any string.

An assistant item keeps a `ChatUiQueryState` (`ChatUiQueryStateSchema`): the writer's chat, and each block's first readings with its frozen fallback. A choice can name the read ids it showed. The host then checks access again and fills in those values.

`ui.link` takes a `ChatUiLinkPayload` (`ChatUiLinkPayloadSchema`) that names a stored node, with the block, local inputs and host-issued read ids. Its `ChatUiLinkReading` (`ChatUiLinkReadingSchema`) says where the link goes, or why it stays plain text. Every open resolves the node and checks access again.

A `ChatUiPlaceReading` (`ChatUiPlaceReadingSchema`) holds the point a host found for a `Place`, with the `address` it looked up. Its `state` is `found` or `missing`. A frozen block keeps them in its optional `places`, by node id.
