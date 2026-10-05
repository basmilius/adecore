# Persistence

Configure storage before the first persistent store read, subscription, write, or render. `ChatHost` and storage are shared across all scopes in one renderer; a scope is not a separate persistence namespace.

## Setup order and lazy hydration

```ts
import { configureChatStorage, chatStorageKey } from '@adecore/agents-react/storage';
import { readDraft } from '@adecore/agents-react/chat/drafts';

configureChatStorage({ namespace: 'workspace-chat' });
export const draftKey = chatStorageKey('drafts');
export const recoveredDraft = readDraft('chat-1');
```

`setChatHost({ storage: options })` calls the same configuration function. Imports do not read browser storage. A persistent hook, `getState`, `subscribe`, `setState`, or `persistedJson.read/write` invokes hydration. The first such access hydrates every store registered so far. A store imported later hydrates on its own first use.

`configureChatStorage` may replace the configuration before hydration. After hydration it throws `Configure chat storage before using chat stores`; there is no public reset or namespace switching operation. Never catch that error and assume the new namespace took effect. Use a fresh renderer/process for an independent storage configuration.

## Keys and adapters

| Record        | Default key                | Namespace suffix   |
| ------------- | -------------------------- | ------------------ |
| `drafts`      | `adecore.chat.drafts`      | `chat.drafts`      |
| `preferences` | `adecore.chat.preferences` | `chat.preferences` |
| `stash`       | `adecore.chat.stash`       | `chat.stash`       |
| `usage`       | `adecore.usage`            | `usage`            |

`namespace` replaces the `adecore` prefix. `keys` overrides individual complete keys and wins over the namespace. These keys identify whole records, not a key per chat. `chatStorageKey(record)` and `chatStorageLegacyKeys(record)` return the current configured values without hydrating stores.

An omitted `storage` adapter accesses `globalThis.localStorage` lazily. If unavailable or denied, it acts like no storage. `storage: null` keeps persistence helpers in memory. A custom synchronous `ChatStorageAdapter` implements only `getItem(key): string | null` and `setItem(key, value): void`. There is no delete method, async database adapter, or package-level encryption.

```ts
import { configureChatStorage, type ChatStorageAdapter } from '@adecore/agents-react/storage';

export const records = new Map<string, string>();
const storage: ChatStorageAdapter = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => {
        records.set(key, value);
    }
};
configureChatStorage({ namespace: 'fixture', storage });
```

This map is a fixture adapter. A production adapter owns persistence and must behave synchronously. Custom adapters do not automatically emit browser storage events.

## Keep keys or migrate raw records

For an existing host, choosing its previous namespace or explicit keys retains records in place. Changing only the package import name does not change the keys or migrate data.

To copy into new keys, list old complete keys in `legacyKeys` or old prefixes in `legacyNamespaces`:

```ts
import { configureChatStorage } from '@adecore/agents-react/storage';

configureChatStorage({
    namespace: 'current-host',
    keys: { preferences: 'settings.agent-preferences' },
    legacyKeys: { drafts: ['archive.drafts'] },
    legacyNamespaces: ['previous-host']
});
```

For each record, a non-null current record always wins. If absent, explicit legacy keys are tried in their given order, then the legacy namespaces in their given order. The first non-null raw JSON string is copied unchanged to the current key and parsed for use. The old key stays in place. A failed copy still permits reading the old value. A malformed current record does not fall through to a legacy record.

Raw copying preserves unknown old fields until the host writes the record again. It does not upgrade schemas, chat IDs, account IDs, or protocol versions. The record's parser decides which old fields the current session uses. Verify the actual legacy values before cutover, especially when the new scope layout changes IDs.

## Record formats

| Record            | Stored content and compatibility                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drafts            | Object keyed by raw chat ID, each with `text` and optional `mentions`, `skills`, `chats`, base64 `attachments`, and `quote`. Older text-only drafts get empty arrays/quote on read.          |
| Chat preferences  | `selectionByProvider`, `lastProvider`, `runtimeMode`, `terminalRuntimeMode`, `accountByMachine`, and `changedAt`. Default modes are `full-access`; default selection maps are empty.         |
| Stash             | Newest-first `StashedPrompt[]`, capped at 20, with ID, text, mentions, skills, file metadata, and creation time. Quotes fold into text. Attachment bytes and chat references are not stored. |
| Usage preferences | `period`, `metric`, and `currency`, defaulting to `7d`, `cost`, and `USD`. Backend summaries and selected host are transient.                                                                |

`parseChatPreferences` keeps known fields. It drops the historical global `selection` and `interactionMode`, because a global model pick cannot be assigned to a provider. `changedAt` participates in backend default-choice arbitration. Do not invent a provider mapping just to preserve an ambiguous old selection.

Drafts use `chatId`, not `scope.keyOf(chatId)`. Stash is shared across chats, and preferences share one record with account choices partitioned by scope ID. Choose globally unique raw chat IDs in a renderer hosting multiple backends. Renaming an ID requires a host migration of its draft entry.

## Failure behavior

`persistedJson.write` returns false on denied/quota writes or memory-only storage. It keeps the attempted value in memory and reads that value until a later successful write. Store setters generally update current-session state before writing. Persistence success is not required to keep using the chat.

Drafts have an extra fallback: after a failed write, `writeDraft` retries without attachment bytes. That applies to `storage: null` too. Text, mentions, skills, referenced chat IDs, and quote can survive in memory, but `readDraft` will no longer recover those uploads. The mounted composer may still hold its uploads; remounting is not a reliable upload recovery strategy. Retain failed outgoing files in host state when needed.

Invalid JSON is caught by persistence readers/parsers and falls back to memory/defaults. These records are not uniformly validated schemas. In particular, the draft reader trusts syntactically valid record shapes; arbitrary valid JSON is not guaranteed to be a usable draft map. Validate imported records in the host before installing them.

## Synchronize preference changes across windows

`CHAT_PREFERENCES_KEY` and `USAGE_PREFERENCES_KEY` are live exports updated by configuration. Read them after setup, or call `chatPreferencesKey()` and `usagePreferencesKey()` when creating the listener:

```ts
import { chatPreferencesKey, reloadChatPreferences } from '@adecore/agents-react/chat/preferences';
import { usagePreferencesKey, reloadUsagePreferences } from '@adecore/agents-react/state/usage';

export function listenForPreferenceChanges(): () => void {
    const receive = (event: StorageEvent): void => {
        if (event.key === chatPreferencesKey()) {
            reloadChatPreferences();
        }
        if (event.key === usagePreferencesKey()) {
            reloadUsagePreferences();
        }
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
}
```

Install this after configuration. Browser storage events come from other windows of the same origin, not the window that wrote the value. No equivalent draft/stash reload API or conflict-free cross-window record merging is provided. A failed local write remains the current session's memory value even when a reload function runs.
