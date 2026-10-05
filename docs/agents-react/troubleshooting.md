# Troubleshooting

Start with setup order and the scope connection. A correctly rendered button cannot repair an absent backend adapter.

| Symptom                                         | What to check                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Cannot import `@adecore/agents-react`           | There is no root barrel. Import an exported subpath such as `chat/ui/Timeline`.                                               |
| Default import fails for a diff                 | `DiffPool`, `EditDiff`, and `UnifiedDiff` use default exports; most other components use named exports.                       |
| Missing `dist` module/declaration               | Build dependencies and package, or select `source` consistently for linked use.                                               |
| Component throws outside a scope                | Wrap it in `ChatScopeContext.Provider`; `useChatScope` deliberately throws without one.                                       |
| Provider/model lists stay empty                 | Supply `providerSinkFor(scopeId)` to `ChatClient`, and make status subscriptions report open transitions.                     |
| Accounts never appear                           | Install `watchProviderAccounts` once for the scope. Initial refusal can mean an older host has no account support.            |
| A closed MessagePort never reconnects           | `portTransport.close()` is final. Create a new runtime for a new port.                                                        |
| Port requests wait indefinitely                 | The port transport has no timeout or native port-closure detector. Its owner must detect closure and call `close()`.          |
| Backend refusal looks like a generic failure    | Preserve a string `code`; use `errorCode` and `isConnectionError` rather than parsing message text.                           |
| Thread has no scrollbar or visible rows         | Give ancestors a height and flex children `min-height: 0`; check Tailwind scan roots.                                         |
| Chat loses attachment previews on remount       | Failed/memory-only draft writes omit bytes. Retain outgoing uploads in host state and check storage quota.                    |
| Composer clears after a rejected send           | `onSend` is void and clears immediately. The host needs failed-send state and retry/recovery UI.                              |
| Old drafts/preferences disappear                | Configure old keys or legacy migration before any persistent read. A package import rename does not migrate data.             |
| Storage configuration throws                    | A hook, `getState`, subscription, setter, or persistent operation already hydrated it. Move setup earlier; there is no reset. |
| New storage namespace did not use old records   | A non-null current key wins, even if malformed; verify explicit-key overrides and legacy-key order.                           |
| A different backend changes a draft             | Drafts use raw chat IDs. Use globally unique IDs across scopes and migrate old draft IDs deliberately.                        |
| Translated keys show as text                    | Load all agent namespaces on the default i18next instance as well as UI words through `UIProvider`.                           |
| Numbers show an unexpected region               | Provide the UI formatter source and its language-change subscription.                                                         |
| Components import correctly but look plain      | Import themes, scan `src` or `dist`, and install the typography plugin in the host CSS pipeline.                              |
| ANSI/diff/find colors are missing               | Add terminal palette variables and Tailwind `--color-term-*`/`--color-find-current` mappings.                                 |
| Diff worker fails after deployment              | Check worker asset URLs/CSP, the worker factory, Suspense, and lazy-open error handling.                                      |
| Search returns an old result                    | Keep the query contract; the composer discards stale responses, but the host still owns request cancellation.                 |
| Dragged path splits into several mentions       | The preserved drag payload is whitespace-delimited with no escaping.                                                          |
| Stop requires confirmation but runs immediately | Default `ChatHost.confirm` calls `run` immediately. Supply the host's policy callbacks.                                       |
| Child conversation says unsupported             | `unknown-request` means the backend lacks `chat.subagent`; the parent row can still render.                                   |
| Usage shows old data after a failure            | Summaries remain in scoped memory; show a host notice and check `failed`/connection state.                                    |

## Refusal codes

The port adapter produces `not-connected` after closure, `disconnected` for pending requests on close, `not-sent` when sending throws, and `bad-reply` when a result fails its schema. It drops malformed frames/events with warnings and ignores responses for unknown request IDs. It does not convert bad frames into a successful empty result.

Backend codes depend on the operation. `chat-not-found`, `chat-busy`, `request-not-found`, `history-expired`, and `unknown-request` have specific handling in the client/UI. Retain their codes in a custom transport. `request-not-found` during queue editing can mean the message already went out; retrying an unqueue as if it were a connection failure would be wrong.

## Diagnose lifetime mistakes

Count runtime creation, watchers, and cleanup. A `ChatClient` is one connection owner, not a hook created on every render. Account watchers are not installed automatically by the provider pane. A client mount registry is not reference-counted; independent open/detach effects for the same ID interfere. A global custom `ChatHost.actions` adapter must route IDs to the right backend.

When reproducing storage issues, start a fresh process and use a map adapter with raw legacy records. When reproducing a UI problem, use a fake provider and both source/default export modes. See [testing](./testing) for the commands and [references](./reference-runtime) for the concrete contracts.
