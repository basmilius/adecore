import { useState } from 'react';
import type { ChatThreadInfo } from '../../../chat-sink';
import { useChatRow } from '../../../state/chats';

export interface PromptSuggestion {
    text: string;
    accept(): void;
    dismiss(): void;
}

interface SuggestionInput {
    chatId: string;
    info: Pick<ChatThreadInfo, 'activeTurnId'>;
    // Whether the box holds nothing a person typed or attached.
    empty: boolean;
    writable: boolean;
    // Whether a prompt card waits on the person, which the suggestion never stands in front of.
    asked: boolean;
    fill(text: string): void;
}

/* The next prompt the CLI predicted, while the box is empty and nothing else asks for the person. */
export function usePromptSuggestion({ chatId, info, empty, writable, asked, fill }: SuggestionInput): PromptSuggestion | null {
    const suggestion = useChatRow(chatId, (row) => row?.suggestion ?? null);
    const [dismissed, setDismissed] = useState<string | null>(null);

    if (suggestion === null || suggestion === dismissed || !empty || !writable || asked || info.activeTurnId !== null) {
        return null;
    }

    return {
        text: suggestion,
        accept: () => fill(suggestion),
        dismiss: () => setDismissed(suggestion)
    };
}
