import { useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Square, TriangleAlert, Workflow } from 'lucide-react';
import type { AgentKind, ChatToolItem, ChatWorkflow } from '@adecore/agent-contracts';
import { Icon, IconButton } from '@adecore/ui';
import { workflowCounts, workflowDescription, workflowPhases, type WorkflowCounts, type WorkflowPhaseView } from '../../logic/workflow';
import { hasToolBody } from '../../logic/tools';
import { useSubagentSupport } from '../../subagent-support';
import type { SubagentStep } from '../../subagent-view';
import { ROW_GUTTER } from '../icons';
import { WorkflowAgentLine } from '../WorkflowAgentLine';
import { ToolBody } from './WorkRows';
import { useChatScope } from '../../../scope';
import { useChats } from '../../../state/chats';
import { useChatActions } from '../../actions';
import { useChatHost } from '../../../host';

function PhaseBlock({ phase, provider, onOpen }: { phase: WorkflowPhaseView; provider: AgentKind | undefined; onOpen?(step: SubagentStep): void }) {
    const { t } = useTranslation('agent-chat');
    const settled = phase.agents.filter((view) => view.state === 'done' || view.state === 'failed').length;

    return (
        <div className="mt-3">
            {phase.title !== null && (
                <div className="flex h-7 min-w-0 items-center gap-2 text-xs">
                    <span className="min-w-0 truncate font-medium text-text">{phase.title}</span>
                    <span className="shrink-0 text-text-faint tabular-nums">
                        {phase.agents.length === 0 ? t('rows.workflow.notStarted') : `${settled}/${phase.agents.length}`}
                    </span>
                </div>
            )}
            {phase.agents.map((view) => (
                <WorkflowAgentLine key={view.agent.index} view={view} provider={provider} onOpen={onOpen} />
            ))}
        </div>
    );
}

function Counts({ counts }: { counts: WorkflowCounts }) {
    const { t } = useTranslation('agent-chat');

    const parts = [
        { key: 'working', count: counts.running, tone: 'text-status-running' },
        { key: 'finished', count: counts.done, tone: 'text-status-idle' },
        { key: 'failedCount', count: counts.failed, tone: 'text-status-error' }
    ].filter((part) => part.count > 0);

    return (
        <span className="shrink-0 truncate text-xs text-text-faint tabular-nums">
            {t('rows.workflow.agents', { count: counts.total })}
            {parts.map((part) => (
                <span key={part.key}>
                    {' · '}
                    <span className={part.tone}>{t(`rows.workflow.${part.key}`, { count: part.count })}</span>
                </span>
            ))}
        </span>
    );
}

/*
 * Keep background progress visible after the launcher turn ends. In the flyout over the composer it
 * has no call to open and is no place in the thread a search jumps to.
 */
export function WorkflowRow({
    tool,
    workflow,
    chatId,
    onOpenAgent,
    place = 'thread'
}: {
    tool: ChatToolItem;
    workflow: ChatWorkflow;
    chatId?: string;
    onOpenAgent?(step: SubagentStep): void;
    place?: 'thread' | 'flyout';
}) {
    const host = useChatHost();
    const { t } = useTranslation('agent-chat');
    const { id, keyOf } = useChatScope();
    const [open, setOpen] = useState(false);
    // A host that does not answer `chat.subagent` has no conversation to open for anyone.
    const refused = useSubagentSupport((s) => s.unsupported[id] === true);
    const provider = useChats((s) => (chatId === undefined ? undefined : s.statusByKey[keyOf(chatId)]?.info?.provider));
    const running = tool.state === 'running';
    const phases = workflowPhases(workflow, running);
    const counts = workflowCounts(phases);
    const description = workflowDescription(tool.input);
    const opens = place === 'thread' && hasToolBody(tool);
    const onOpen = refused ? undefined : onOpenAgent;
    const actions = useChatActions();

    const stop = (): void => {
        if (chatId && workflow.taskId) {
            void actions.stopTask(chatId, workflow.taskId).catch((error: unknown) => {
                host.notify({
                    kind: 'error',
                    title: t('activity.stopFailed'),
                    description: error instanceof Error ? error.message : t('subagents.noAnswer')
                });
            });
        }
    };

    const failed = tool.state === 'error';

    const header = (
        <>
            <span className={clsx(ROW_GUTTER, running && 'text-accent')}>
                <Icon icon={Workflow} size={12} />
            </span>
            <span className={clsx('shrink-0', running && 'chat-live-text')}>{t(`rows.workflow.${running ? 'running' : failed ? 'failed' : 'done'}`)}</span>
            <span className="grow" />
            {counts.total > 0 && <Counts counts={counts} />}
            {opens && <Icon icon={ChevronRight} size={12} className={clsx('shrink-0 text-text-faint transition-transform', open && 'rotate-90')} />}
        </>
    );

    const headerClasses = clsx(
        '-mx-1 flex h-7 w-[calc(100%+8px)] min-w-0 items-center gap-2 rounded-md px-1 text-left text-xs',
        failed ? 'text-status-error' : 'text-text-muted',
        opens && 'hover:bg-surface-hover'
    );

    return (
        <div data-find-item={place === 'thread' ? tool.id : undefined} className="mb-1">
            <div className="flex items-center gap-1">
                <div className="min-w-0 grow">
                    {opens ? (
                        <button className={headerClasses} onClick={() => setOpen((value) => !value)}>
                            {header}
                        </button>
                    ) : (
                        <div className={headerClasses}>{header}</div>
                    )}
                </div>
                {running && chatId && workflow.taskId && <IconButton icon={Square} size="xs" label={t('activity.stop')} onClick={stop} />}
            </div>
            {open && opens && <ToolBody tool={tool} chatId={chatId} />}
            <div className="mt-1.5 ml-6">
                {workflow.name !== null && <div className="truncate text-sm font-medium text-text">{workflow.name}</div>}
                {description !== null && <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{description}</p>}
                {running && workflow.stalledAt !== undefined && (
                    <p role="status" className="mt-1 flex items-start gap-1.5 text-xs text-text-muted">
                        <Icon icon={TriangleAlert} size={12} className="mt-0.5 shrink-0 text-status-needs-you" />
                        <span>{t('rows.workflow.stalled')}</span>
                    </p>
                )}
                {phases.map((phase) => (
                    <PhaseBlock key={phase.key} phase={phase} provider={provider} onOpen={onOpen} />
                ))}
            </div>
        </div>
    );
}
