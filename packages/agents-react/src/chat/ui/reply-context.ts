import { createContext } from 'react';
import type { ChatInfo } from '@adecore/agent-contracts';

export const ReplyContext = createContext<{ provider: ChatInfo['provider']; chatId?: string } | null>(null);
