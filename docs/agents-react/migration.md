# Migration

Moving a reusable chat implementation into this package changes imports and adapter ownership. It does not, by itself, change storage records, chat/account IDs, transport frames, provider transcripts, or backend policy. Validate those boundaries separately.

## Preserve setup and data

First identify the four existing browser storage records and their raw values. Configure the old namespace or full keys before any persistent operation, or add ordered legacy keys to copy raw records. Keep raw JSON fixtures for drafts with mentions, skills, files, chat references, and quotes; per-provider/account preferences; stash; and usage choices. The package retains old keys when copying. See [persistence](./persistence).

Keep stable scope IDs if account defaults use them. Chat rows can use a new `keyOf` scheme, but persistent draft entries still use raw chat IDs. A new key scheme is not a draft migration. Do not change IDs until the host can map existing records and cross-chat references.

Preserve provider-specific model selections and backend `changedAt` arbitration. An obsolete global model choice is intentionally dropped by the parser because its provider cannot be inferred. Preserve the current runtime-mode semantics; the default preference modes are `full-access`, and the host remains responsible for enforcing the actual policy.

## Replace interfaces with host adapters

| Previous responsibility                   | Package boundary                                                | Remains in the host                                                 |
| ----------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Chat wire connection                      | `ChatTransport` or `portTransport(FramePort)`                   | IPC/socket setup, sender checks, frame dispatch, reconnect/timeouts |
| Thread state and events                   | `ChatClient`, `chatSink`, scoped stores                         | Runtime lifetime and host removal                                   |
| File search, image paths, attachment URLs | `ChatHost.searchFiles`, `ReadImage`, `attachments`, `fileLinks` | Authorized file access, path validation, object URL cleanup         |
| Permission UI and task actions            | Prompt views/sessions and `ChatActions`                         | Policy, extra host prompts, confirmations, task subscriptions       |
| Login/settings/navigation                 | `openLogin`, `openSettings`, `useChatPlace`, `fork`             | Executable/environment filtering and destinations                   |
| Host-specific chat controls/cards         | Composer/Subagent slots and thread hooks                        | Data sources, timestamps, stable hook identities                    |
| Styling/words                             | Package CSS and locale assets                                   | Tailwind scanning, theme tokens, format source, worker CSP          |

Do not import the backend `@adecore/agents` into the browser to fill a missing adapter. Keep your application envelope/channel composition around the shared agent schemas. A package rename is not a protocol-version bump. A backend that lacks an optional request may still be compatible; the UI documents account, child-conversation, bookmark, and turn-ID fallbacks where implemented.

## Coordinate mention drags

Update file-list producers and composer/drop receivers together. New producers use `writeMentionDrag`, which writes new and transitional MIME values. New receivers use `carriesMentions` and `droppedMentions`, which accept both. Stop writing the transitional format only after every receiver has migrated.

Keep the space-separated payload unchanged during this move. It still cannot represent a path containing whitespace as one token. Keyboard insertion, picker selection, file drops, and ordinary text selection are distinct flows; test them all. See [attachments and mentions](./attachments#migrate-drag-producers-and-receivers-together).

## Verify linked and compiled consumers

Source linking needs the `source` export condition and Tailwind `src` scanning. Default exports need built declarations/JavaScript and `dist` scanning. Both need UI/chat themes, typography rules, locale JSON, terminal/find token mappings, and a working diff worker factory. A source-only typecheck can hide a missing compiled asset or incorrect declaration export.

Use the [fake-provider checks](./testing) before connecting a real backend. Then verify reconnect replay, queued-message editing, failed sends/uploads, request refusals, preference propagation, account changes, usage subscriptions, child conversations, and cleanup in the consuming host. Keep original implementations until the entire consumer cutover and migration validation pass. Package tests alone do not establish that existing records and host policy survived.

The new package remains private at `0.0.0`; publication and Trusted Publishing setup are separate work. Preserve its FSL-1.1-MIT license and transferred provenance. This guide does not authorize a release or deletion of source implementations.
