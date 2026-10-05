# Language-enabled React file editors

`@adecore/editor-react` connects a DOM editor to an injected `LanguageService` and draws the resulting React popups. It includes completion/snippet handling, hover, signatures, diagnostics, semantic colors, inlay hints, folds, symbols, navigation, code actions, rename, and peek. It also exports proposal/review models and displays whose data and actions come from the host.

This is a file editor with file/document lifetimes. It does not provide a chat composer, start a language server, save a draft automatically, or run an agent. Filesystem policy, navigation between host views, persistence, process installation, and AI orchestration belong to adapters.

The package is private at `0.0.0` pending publication. Local source-conditioned imports read `src`; compiled/default imports and declarations read `dist` after dependency-ordered builds. React 19, React DOM, UI, i18next, and react-i18next are peers. Use one React instance across linked packages.

## Public entry points

| Import                                             | Purpose                                                                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@adecore/editor-react`                            | Coordinators, React views/popups, host types, problem and navigation state, workspace edits, row/highlight helpers          |
| `@adecore/editor-react/models`                     | Pure completion, snippet, hover, signature, diagnostic, symbol, action, diff/proposal, find, placement, and conflict models |
| `@adecore/editor-react/testing`                    | `FakeLanguageService`, `ManualTimers`, test call types                                                                      |
| `@adecore/editor-react/editor-react.css`           | React editor styles; import after editor CSS                                                                                |
| `@adecore/editor-react/locales/en.json`, `nl.json` | Resources for the `editor` i18next namespace                                                                                |

Read [a working composition](./getting-started), [host integration](./host-integration), [completion and information](./completion-information), [diagnostics, tokens, and hints](./diagnostics-tokens), [navigation and changes](./navigation-changes), [review and proposals](./review-proposals), and [lifecycle, testing, and migration](./lifecycle-testing).

The current language coordinators and host types are present in the extracted source. Some application-level features remain host work: agent request/session ownership, streaming suggestions, accepting/rejecting proposals, durable inline-edit records, Git/provenance queries, server management UI, and complete accessibility validation. Exported models or locale strings for those behaviors do not imply that orchestration exists in this package.
