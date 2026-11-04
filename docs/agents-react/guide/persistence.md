# Persistence

Four records outlive a reload: drafts, chat preferences, the stash and the usage page's choices. Threads and everything else come from the host again.

## Configure first

```ts
import { configureChatStorage } from '@adecore/agents-react';

configureChatStorage({ namespace: 'my-app' });
```

Call it before the first render, outside React. The first read of any record fixes the configuration, and configuring after that throws `Configure chat storage before using chat stores`. There is no reset.

| Record        | Key                        |
| ------------- | -------------------------- |
| `drafts`      | `<namespace>.chat.drafts`      |
| `preferences` | `<namespace>.chat.preferences` |
| `stash`       | `<namespace>.chat.stash`       |
| `usage`       | `<namespace>.usage`            |

The namespace is `adecore` unless you set one. `keys` names a record's whole key and wins over the namespace. The options are `ChatStorageOptions`, and a record's name is a `ChatStorageRecord`: `drafts`, `preferences`, `stash` or `usage`.

## Where it is kept

Without `storage` the records go to `localStorage`, or to memory when it is unavailable. `storage: null` keeps them in memory. Anything else is a synchronous `ChatStorageAdapter`, `{ getItem(key), setItem(key, value) }`:

```ts
const records = new Map<string, string>();

configureChatStorage({
    namespace: 'my-app',
    storage: { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => void records.set(key, value) }
});
```

A failed write keeps the value in memory for the session. When a draft does not fit, the store saves it without its files.

## Moving from older keys

List older keys, and the first read copies the old record over:

```ts
configureChatStorage({
    namespace: 'my-app',
    legacyKeys: { drafts: ['old-app.drafts'] },
    legacyNamespaces: ['old-app']
});
```

A current key that holds anything wins. Otherwise the read tries `legacyKeys` in order, then `legacyNamespaces`, and copies the first value it finds unchanged. The old key stays.

## What the records hold

- Drafts are keyed by chat id, not by scope, so keep chat ids unique on the page. A draft holds its text, mentions, skills, referenced chats, quote and files. `readDraft`, `writeDraft` and `useDrafts` read and write them; `offerDraft(chatId, text)` adds text under the draft. A draft is a `ChatDraft`, and `EMPTY_DRAFT` is one with nothing in it.
- Preferences hold the model per CLI (`selectionByProvider`), the last CLI, the runtime mode for chats and terminals (`full-access` by default), the account per host and CLI for a host that keeps no order of its accounts (`accountByMachine`), the reading width, the send key, the starred models and `changedAt`. `chatPreferencesPayload` builds the payload of `ChatClient.setPreferences`.
- The preferences are a `ChatPreferences` in the store `useChatPreferences`; `readChatPreferences()` reads them outside React. `rememberChatSelection(provider, selection)` stores the model picked for a CLI. `defaultProvider(preferences)` is the CLI a chat without one opens on, the last one a model was picked for, and `selectionFor(preferences, provider)` the model a chat of that CLI starts with, or `null` to leave it to the CLI.
- The reading width is a `ChatReadingWidth`, and the send key a `ChatSendKey`: Enter, Enter until the message runs over one line, or Mod+Enter always.
- The stash holds up to `STASH_LIMIT` prompts, newest first, for every chat. It keeps text, mentions, skills and file names, not the files: each is a `StashedPrompt`, with a `StashedAttachment` per file that says what it was.
- Usage holds the period (`7d`), the metric (`cost`) and the currency (`USD`).

## Another window

Another window of the same origin sends a `storage` event. Reload the preferences when their key changes:

```ts
import { CHAT_PREFERENCES_KEY, reloadChatPreferences } from '@adecore/agents-react/chat';
import { reloadUsagePreferences, USAGE_PREFERENCES_KEY } from '@adecore/agents-react/state';

window.addEventListener('storage', (event) => {
    if (event.key === CHAT_PREFERENCES_KEY) {
        reloadChatPreferences();
    }

    if (event.key === USAGE_PREFERENCES_KEY) {
        reloadUsagePreferences();
    }
});
```

`CHAT_PREFERENCES_KEY` and `USAGE_PREFERENCES_KEY` follow the configuration. Drafts and the stash have no reload.
