import type { ChatInfo } from '@adecore/agent-contracts';
import { createContext } from 'react';
import type { UiReplyTarget } from '../logic/timeline-target';

export const ReplyContext = createContext<{ provider: ChatInfo['provider']; chatId?: string } | null>(null);

export const UiReplyNavigationContext = createContext<{
    chatId: string;
    reveal(target: UiReplyTarget): void;
    flash: (UiReplyTarget & { nonce: number }) | null;
} | null>(null);
