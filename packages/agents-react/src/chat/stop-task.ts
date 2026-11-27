import { useTranslation } from 'react-i18next';
import { useChatHost } from '../host/host';
import { useChatActions } from './actions';

/* Stops a command or monitor a chat runs in the background, and tells the person when the host refused. */
export function useStopTask(chatId: string): (taskId: string) => void {
    const host = useChatHost();
    const { t } = useTranslation('agent-chat');
    const actions = useChatActions();

    return (taskId) => {
        void actions.stopTask(chatId, taskId).catch((error: unknown) => {
            const description = error instanceof Error ? error.message : t('subagents.noAnswer');
            host.notify({ kind: 'error', title: t('activity.stopFailed'), description });
        });
    };
}
