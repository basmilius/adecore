import { formatMoment } from '@adecore/ui/format';
import i18next from 'i18next';
import type { ChatThreadInfo } from '../../chat-sink';

interface LimitView {
    /* The state in a word or two with its time, for a pill in a header. */
    pill: string;
    title: string;
    /* When it goes on, or what a person can do; null when the CLI named no time and nothing is owed. */
    detail: string | null;
}

/*
 * What a chat that stopped on a limit says about it, from its info alone, so a header that never holds
 * the thread says the same as the chat. Null while the last turn stopped on nothing, or a turn runs.
 */
export function limitView(info: Pick<ChatThreadInfo, 'limit' | 'resumeAt' | 'activeTurnId'>, now: number): LimitView | null {
    const limit = info.limit;

    if (limit === undefined || info.activeTurnId !== null) {
        return null;
    }

    const resumes = info.resumeAt === undefined ? null : formatMoment(info.resumeAt, now);

    if (limit.kind === 'overload') {
        return {
            pill: resumes === null ? i18next.t('agent-chat:limit.overload.pill') : i18next.t('agent-chat:limit.overload.pillRetry', { time: resumes }),
            title: i18next.t('agent-chat:limit.overload.title'),
            detail: resumes === null ? i18next.t('agent-chat:limit.overload.sendAgain') : i18next.t('agent-chat:limit.overload.retries', { time: resumes })
        };
    }

    // A kind of a newer host says only that the turn stopped, never which limit it was.
    if (limit.kind !== 'usage') {
        return { pill: i18next.t('agent-chat:limit.other.pill'), title: i18next.t('agent-chat:limit.other.title'), detail: null };
    }

    const title = i18next.t('agent-chat:limit.usage.title');

    if (resumes !== null) {
        return {
            pill: i18next.t('agent-chat:limit.usage.pillResumes', { time: resumes }),
            title,
            detail: i18next.t('agent-chat:limit.usage.resumes', { time: resumes })
        };
    }

    if (limit.resetsAt !== undefined && limit.resetsAt <= now) {
        return { pill: i18next.t('agent-chat:limit.usage.pillReset'), title, detail: i18next.t('agent-chat:limit.usage.reset') };
    }

    if (limit.resetsAt !== undefined) {
        const resets = formatMoment(limit.resetsAt, now);

        return {
            pill: i18next.t('agent-chat:limit.usage.pillUntil', { time: resets }),
            title,
            detail: i18next.t('agent-chat:limit.usage.resets', { time: resets })
        };
    }

    return { pill: i18next.t('agent-chat:limit.usage.pill'), title, detail: null };
}
