import { createContext } from 'react';
import type { ChatThreadInfo } from '../../chat-sink';
import type { UiReplyTarget } from '../logic/timeline-target';

export const ReplyContext = createContext<{ provider: ChatThreadInfo['provider']; chatId?: string } | null>(null);

export const UiReplyNavigationContext = createContext<{
    chatId: string;
    reveal(target: UiReplyTarget): void;
    flash: (UiReplyTarget & { nonce: number }) | null;
} | null>(null);
