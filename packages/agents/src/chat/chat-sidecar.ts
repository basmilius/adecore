import type { ChatVisual } from '@adecore/agent-contracts';
import { isBookmarkFileName, type BookmarkStore } from './bookmark-store.ts';
import { isVisualFileName, type VisualStore } from './visual-store.ts';

/* What a fork keeps of the conversation it was cut from. */
export interface ForkKept {
    /* Whether a message of the original is in the fork's thread. */
    item(itemId: string): boolean;
    /* Whether a visual of the original goes along. */
    visual(visual: ChatVisual): boolean;
}

/*
 * What a host keeps for a chat beside its record, which lives and dies with the chat. The core asks
 * every sidecar when it lists chats, clears, deletes or removes one, and forks one; each member is
 * left out by a sidecar that has nothing to say about it (images in the attachment folder go with
 * the attachments, so theirs only copies).
 */
export interface ChatSidecar {
    /* Whether a file name in the chats folder is one of its files, which the chat list must not take for a chat. */
    owns?(name: string): boolean;
    /* Removes everything kept for the chat. */
    removeChat?(chatId: string): Promise<void>;
    /* Gives a fork the part of the original's that it keeps. */
    copyChat?(fromChatId: string, toChatId: string, kept: ForkKept): Promise<void>;
}

/* The bookmarks of a chat, which a fork keeps on the messages it copied. */
export function bookmarkSidecar(store: BookmarkStore): ChatSidecar {
    return {
        owns: isBookmarkFileName,
        removeChat: (chatId) => store.removeChat(chatId),
        copyChat: (fromChatId, toChatId, kept) => store.copyChat(fromChatId, toChatId, (itemId) => kept.item(itemId))
    };
}

/* The visuals of a chat, each copied with a page of its own. */
export function visualSidecar(store: VisualStore): ChatSidecar {
    return {
        owns: isVisualFileName,
        removeChat: (chatId) => store.removeChat(chatId),
        copyChat: async (fromChatId, toChatId, kept) => {
            await store.copyChat(fromChatId, toChatId, (visual) => kept.visual(visual));
        }
    };
}
