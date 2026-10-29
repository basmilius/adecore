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

The namespace is `adecore` unless you set one. `keys` names a record's whole key and wins over the namespace.

## Where it is kept

Without `storage` the records go to `localStorage`, or to memory when it is unavailable. `storage: null` keeps them in memory. Anything else is a synchronous `ChatStorageAdapter`, `{ getItem(key), setItem(key, value) }`:

```ts
const records = new Map<string, string>();

configureChatStorage({
    namespace: 'my-app',
    storage: { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => void records.set(key, value) }
});
```

A failed write keeps the value in memory for the session. A draft that does not fit is saved without its files.

## Moving from older keys

List older keys, and the first read copies the old record over:

```ts
configureChatStorage({
    namespace: 'my-app',
    legacyKeys: { drafts: ['old-app.drafts'] },
    legacyNamespaces: ['old-app']
});
```

A current key that holds anything wins. Otherwise `legacyKeys` are tried in order, then `legacyNamespaces`, and the first value is copied unchanged. The old key stays.

## What the records hold

- Drafts are keyed by chat id, not by scope, so keep chat ids unique on the page. A draft holds its text, mentions, skills, referenced chats, quote and files. `readDraft`, `writeDraft` and `useDrafts` read and write them; `offerDraft(chatId, text)` adds text under the draft.
- Preferences hold the model per CLI (`selectionByProvider`), the last CLI, the runtime mode for chats and terminals (`full-access` by default), the reading width, the send key, the starred models and `changedAt`. `chatPreferencesPayload` builds the payload of `ChatClient.setPreferences`.
- The stash holds up to `STASH_LIMIT` prompts, newest first, for every chat. It keeps text, mentions, skills and file names, not the files.
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
