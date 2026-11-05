import { useEffect, useState } from 'react';
import type { PromptSubject } from '../../../host/prompts';
import { useChatScope } from '../../../scope';
import { ChatPromptFeed } from '../../pending-prompts';

export function usePendingRequests(chatId: string): PromptSubject[] {
    const scope = useChatScope();
    const [subjects, setSubjects] = useState<PromptSubject[]>([]);

    useEffect(() => {
        const feed = new ChatPromptFeed(scope, chatId, setSubjects);
        feed.start();

        return () => feed.dispose();
    }, [scope, chatId]);

    return subjects;
}
