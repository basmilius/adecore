import type { ChatItem } from '@adecore/agent-contracts';
import { useChatHost } from '../../host';
import { useHostReferables } from '../../host-hooks';
import { useChatScope } from '../../scope';
import { useChatRow } from '../../state/chats';
import type { ReferenceLookup } from './reference-lookup';

const referencedOf = new WeakMap<Record<string, ChatItem>, string>();

/*
 * The ids a person pointed at with `#` in a thread, one per line. A string, so the selector that reads
 * it answers the same value until a message with another one comes; the structure a streamed word
 * leaves alone is what it is cached on.
 */
export function threadReferencedKey(structure: Record<string, ChatItem> | undefined): string {
    if (structure === undefined) {
        return '';
    }

    const cached = referencedOf.get(structure);

    if (cached !== undefined) {
        return cached;
    }

    const ids = new Set<string>();

    for (const item of Object.values(structure)) {
        if (item.kind === 'user') {
            for (const id of [...(item.chats ?? []), ...(item.references ?? [])]) {
                ids.add(id);
            }
        }
    }

    const key = [...ids].join('\n');
    referencedOf.set(structure, key);

    return key;
}

/* What the views, nodes and chats of a thread stand for now, and how one opens, for the rows that draw chips. */
export function useReferenceLookup(chatId: string): ReferenceLookup {
    const { id: scopeId } = useChatScope();
    const { openReference } = useChatHost();
    const referables = useHostReferables(scopeId, chatId);
    const key = useChatRow(chatId, (chat) => threadReferencedKey(chat?.structure));

    return {
        items: referables.items,
        open: openReference ? (id: string) => openReference(scopeId, id) : null,
        referenced: key === '' ? [] : key.split('\n')
    };
}
