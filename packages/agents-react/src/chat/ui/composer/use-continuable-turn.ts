import type { ChatThreadInfo, ChatThreadItem } from '../../../chat-sink';
import { useChatRow } from '../../../state/chats';
import { continuableTurn } from '../../logic/continue-after-stop';

export function useContinuableTurn(chatId: string, info: ChatThreadInfo): string | null {
    const order = useChatRow(chatId, (row) => row?.order);
    const structure = useChatRow(chatId, (row) => row?.structure);
    const items = (order ?? []).map((id) => structure?.[id]).filter((item): item is ChatThreadItem => item !== undefined);

    return continuableTurn(info, items);
}
