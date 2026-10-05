# @adecore/agents-react

React agent chat threads, a CodeMirror composer, approvals/questions, provider account settings, and usage views. The host supplies a typed connection and adapters for files, permissions, login, task state, and navigation. Backend provider execution stays outside the browser.

Import per module. There is no root barrel:

```tsx
import { Composer } from '@adecore/agents-react/chat/ui/Composer';
import { Timeline } from '@adecore/agents-react/chat/ui/Timeline';
import { ChatClient } from '@adecore/agents-react/chat/chat-client';
import { portTransport } from '@adecore/agents-react/port-transport';

export const agentViews = { Composer, Timeline, ChatClient, portTransport };
```

The host brings React/React DOM 19, i18next, react-i18next, and `@adecore/ui` as peers. The package depends on `@adecore/agent-contracts` and uses Zustand, CodeMirror, Shiki, and the diff library. Consult the manifest for exact peer ranges. Import `@adecore/ui/theme.css` before `@adecore/agents-react/theme.css`; use Tailwind 4, scan linked `src` or compiled `dist`, and load the typography plugin. Terminal/find colors need host tokens and utility mappings.

Configure `setChatHost({ storage })` before any persistent store use. A `ChatScopeContext` supplies one stable transport/client per backend. The host singleton and persistence configuration are shared across scopes. Use unique chat IDs across scopes because drafts use raw IDs. `portTransport.close()` rejects waiting requests and stops frame listening; the owner also closes its native port. `ChatClient.dispose()` releases subscriptions and detaches views without stopping agents.

## Documentation

- [Overview](../../docs/agents-react/index.md)
- [Installation and setup](../../docs/agents-react/getting-started.md)
- [Host adapters](../../docs/agents-react/host.md)
- [Chat state and lifecycle](../../docs/agents-react/chat-lifecycle.md)
- [Composer](../../docs/agents-react/composer.md)
- [Attachments and mentions](../../docs/agents-react/attachments.md)
- [Messages and timeline](../../docs/agents-react/timeline.md)
- [Approvals and tasks](../../docs/agents-react/approvals-tasks.md)
- [Accounts and models](../../docs/agents-react/accounts-models.md)
- [Usage](../../docs/agents-react/usage.md)
- [Persistence](../../docs/agents-react/persistence.md)
- [CSS, theme, and translations](../../docs/agents-react/styling.md)
- [Testing](../../docs/agents-react/testing.md)
- [Migration](../../docs/agents-react/migration.md)
- [Troubleshooting](../../docs/agents-react/troubleshooting.md)
- [Runtime reference](../../docs/agents-react/reference-runtime.md)
- [Chat reference](../../docs/agents-react/reference-chat.md)
- [Settings reference](../../docs/agents-react/reference-settings.md)

The reference pages group all preserved module subpaths, including lower-level renderers, prompt/session helpers, account forms, and usage formatters. `DiffPool`, `EditDiff`, and `UnifiedDiff` use default exports.

## Compatibility and verification

Storage keys default to `adecore.chat.drafts`, `adecore.chat.preferences`, `adecore.chat.stash`, and `adecore.usage`. Keep previous keys/namespace in place or configure ordered legacy keys to copy raw records unchanged, retaining their old copies. Setup after hydration throws. Custom synchronous storage and memory-only storage are supported; failed draft writes may omit attachment bytes. See the persistence guide for formats and cross-window listeners.

Mention drags use `application/x-adecore-mention`. `writeMentionDrag` writes both new and transitional formats by default, and `carriesMentions`/`droppedMentions` read both. Migrate producers and receivers together before disabling legacy writes. The existing space-separated payload still cannot represent whitespace-containing paths as one token. The chat CodeMirror input is separate from the file editor.

`AGENTS_LOCALES` loads English/Dutch for `agent-chat`, `agent-prompts`, `agent-providers`, and `agent-usage`. Load them on the default i18next instance used by package helpers and React. `UIProvider` supplies UI words and formatter setup separately.

Build dependencies before default-export checks. The [agent-port example](../../examples/agent-port) safely verifies `AgentHost`, a fake CLI, `FramePort`, `portTransport`, `ChatClient`, rendered scope context, locale loading, reply state, and structured refusals. `fixtures/storage.mjs` runs storage compatibility checks in a fresh process. Package typecheck/tests and source/default consumer checks are described in the testing guide.

This package remains private at `0.0.0` pending publication setup. Source-condition imports support a linked checkout; default exports require built artifacts. The transferred code retains FSL-1.1-MIT; see [LICENSE](./LICENSE).
