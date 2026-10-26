import { useEffect, useState } from 'react';
import type { ChatInfo, ChatItem, ProviderCapabilities } from '@adecore/agent-contracts';
import { useChatRow } from '../../../state/chats';
import { RESUME_COMPACTION_TOKENS, resumeCompactionDueAt, resumeCompactionOffer, watchDueAt, type DueClock } from '../../logic/resume-compaction';
import { useResumeCompactionDismissal } from '../../resume-compaction-dismissals';

const PAGE_CLOCK: DueClock = {
    now: () => Date.now(),
    setTimer: (run, ms) => setTimeout(run, ms),
    clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
    onWake: (wake) => {
        if (typeof window === 'undefined') {
            return () => {};
        }

        window.addEventListener('focus', wake);
        document.addEventListener('visibilitychange', wake);

        return () => {
            window.removeEventListener('focus', wake);
            document.removeEventListener('visibilitychange', wake);
        };
    }
};

/* The offer to fold a long context before a chat whose cache went cold goes on, or null when there is none. */
export function useCompactionOffer(chatId: string, info: ChatInfo, compaction: ProviderCapabilities['compaction'] | undefined) {
    const order = useChatRow(chatId, (row) => row?.order);
    const structure = useChatRow(chatId, (row) => row?.structure);
    const dismissedTurnId = useResumeCompactionDismissal(chatId);
    const [now, setNow] = useState(Date.now);
    // The cheap half of the offer, so a chat that can never make one walks no thread.
    const couldOffer = compaction !== undefined && compaction !== 'none' && info.usage.contextTokens >= RESUME_COMPACTION_TOKENS;
    const items = couldOffer ? (order ?? []).map((id) => structure?.[id]).filter((item): item is ChatItem => item !== undefined) : [];
    const input = { info, compaction, items, dismissedTurnId };
    const dueAt = couldOffer ? resumeCompactionDueAt(input) : null;

    // A watch for the moment the offer comes due, so a chat that can never make one keeps none.
    useEffect(() => {
        if (dueAt === null) {
            return;
        }

        return watchDueAt(dueAt, setNow, PAGE_CLOCK);
    }, [dueAt]);

    return dueAt === null ? null : resumeCompactionOffer({ ...input, now });
}
