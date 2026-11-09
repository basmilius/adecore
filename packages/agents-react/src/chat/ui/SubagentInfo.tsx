import { taskIdOfRow } from '@adecore/agent-contracts';
import { Tooltip, useNow } from '@adecore/ui';
import { useTranslation } from 'react-i18next';
import { useModelName } from '../../agents/model-name';
import { useHostTask } from '../../host/host-hooks';
import { useChatScope } from '../../scope';
import { useChatRow } from '../../state/chats';
import { entryTimeOf, statusWordOf } from '../subagent-list';
import { useSubagentItem } from '../subagent-view';
import { StatusIcon } from './ChatActivity';
import { SubagentActions, SubagentBreadcrumb } from './SubagentControls';

/*
 * What a sub-agent is, over its conversation: its state, with its time in the tooltip, the way down to
 * it, the model it runs on, and the way out. Only the way down and out for a conversation whose row the
 * thread lost.
 */
export function SubagentInfo({ chatId, toolUseId }: { chatId: string; toolUseId: string }) {
    const { t } = useTranslation('agent-chat');
    const { id } = useChatScope();
    const item = useSubagentItem(chatId, toolUseId);
    const provider = useChatRow(chatId, (row) => row?.info.provider);
    const task = useHostTask(id, item === null ? null : taskIdOfRow(item));
    const modelName = useModelName(provider, item?.model ?? '');
    const now = useNow(1000, item?.status === 'running');
    const word = item === null ? null : statusWordOf(item, task);
    const time = item === null ? '' : entryTimeOf(item, task, now);

    return (
        <section aria-label={t('subagents.info.label')} className="shrink-0 border-b border-border py-1.5 pr-1.5 pl-4">
            <div className="flex min-w-0 items-center gap-2 text-xs text-text-faint">
                {word !== null && (
                    <Tooltip label={time === '' ? t(`common.status.${word}`) : time}>
                        <span className="flex shrink-0" role="img" aria-label={t(`common.status.${word}`)}>
                            <StatusIcon word={word} />
                        </span>
                    </Tooltip>
                )}
                <SubagentBreadcrumb chatId={chatId} className="max-w-1/2 shrink-0 font-medium" />
                {item?.model !== undefined && modelName !== '' && (
                    <>
                        <span aria-hidden="true">·</span>
                        <span className="min-w-0 truncate">{modelName}</span>
                    </>
                )}
                <span className="grow" />
                <SubagentActions chatId={chatId} />
            </div>
        </section>
    );
}
