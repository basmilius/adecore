import { useEffect, useState } from 'react';
import { useChatScope } from '../../../scope';
import type { PromptSubject } from '../../../prompts/logic/subjects';
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
