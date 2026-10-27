import { useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Bot, ChevronRight, Square, TriangleAlert, Workflow, X } from 'lucide-react';
import { workflowAgentRef, type AgentKind, type ChatToolItem, type ChatWorkflow } from '@adecore/agent-contracts';
import { formatElapsedShort } from '@adecore/ui/format';
import { Icon, IconButton, useTickingText } from '@adecore/ui';
import { AgentIcon } from '../../../agents/AgentIcon';
import {
    workflowAgentPreview,
    workflowAgentTime,
    workflowCounts,
    workflowDescription,
    workflowPhases,
    type WorkflowAgentState,
    type WorkflowAgentView,
    type WorkflowCounts,
    type WorkflowPhaseView
} from '../../logic/workflow';
import { hasToolBody } from '../../logic/tools';
import { useSubagentSupport } from '../../subagent-support';
import type { SubagentStep } from '../../subagent-view';
import { ROW_GUTTER } from '../icons';
import { ToolBody } from './WorkRows';
import { useChatScope } from '../../../scope';
import { useChats } from '../../../state/chats';
import { useChatActions } from '../../actions';
import { useChatHost } from '../../../host';

const DOT: Record<WorkflowAgentState, string> = {
    running: 'bg-status-running',
    waiting: 'bg-text-faint',
    stopped: 'bg-text-faint',
    done: 'bg-status-idle',
    failed: 'bg-status-error'
};

const TIME = 'shrink-0 text-xs text-text-faint tabular-nums';

function Elapsed({ startedAt }: { startedAt: number }) {
    const ref = useTickingText(() => formatElapsedShort(Date.now() - startedAt));

    return <span ref={ref} className={TIME} />;
}

function AgentLine({ view, provider, onOpen }: { view: WorkflowAgentView; provider: AgentKind | undefined; onOpen?(step: SubagentStep): void }) {
    const { agent, state } = view;
    const time = workflowAgentTime(view);
    const preview = workflowAgentPreview(view);
    const agentId = agent.agentId;
    // One still waiting has no transcript yet.
    const open = onOpen !== undefined && agentId !== null ? () => onOpen({ toolUseId: workflowAgentRef(agentId), description: agent.label }) : undefined;

    return (
        <button
            className="-mx-1 mb-0.5 flex w-[calc(100%+8px)] items-start gap-2 rounded-md px-1 py-1 text-left enabled:hover:bg-surface-hover"
            disabled={open === undefined}
            onClick={open}
        >
            <span className={clsx(ROW_GUTTER, 'relative text-text')}>
                {provider === undefined ? <Icon icon={Bot} size={14} /> : <AgentIcon kind={provider} size={14} />}
                <span className={clsx('absolute -right-0.75 bottom-0 size-2 rounded-full ring-2 ring-surface', DOT[state])} />
            </span>
            <span className="flex min-w-0 grow flex-col">
                <span data-find-field="summary" className={clsx('truncate text-xs font-medium', state === 'failed' ? 'text-status-error' : 'text-text')}>
                    {agent.label}
                </span>
                {(preview.tool !== null || preview.text !== null) && (
                    <span className="truncate text-2xs text-text-muted">
                        {preview.tool !== null && <span className="font-mono text-code">{preview.tool}</span>}
                        {preview.tool !== null && preview.text !== null && ' · '}
                        {preview.text}
                    </span>
                )}
            </span>
            <span className="flex h-5 shrink-0 items-center gap-2">
                {state === 'running' && agent.startedAt !== null ? (
                    <Elapsed startedAt={agent.startedAt} />
                ) : (
                    time !== null && <span className={TIME}>{time}</span>
                )}
                {state === 'failed' && <Icon icon={X} size={12} className="shrink-0 text-status-error" />}
                <Icon icon={ChevronRight} size={12} className={clsx('shrink-0 text-text-faint', open === undefined && 'invisible')} />
            </span>
        </button>
    );
}

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
                <AgentLine key={view.agent.index} view={view} provider={provider} onOpen={onOpen} />
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

// Keep background progress visible after the launcher turn ends.
export function WorkflowRow({
    tool,
    workflow,
    chatId,
    onOpenAgent
}: {
    tool: ChatToolItem;
    workflow: ChatWorkflow;
    chatId?: string;
    onOpenAgent?(step: SubagentStep): void;
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
    const opens = hasToolBody(tool);
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
        <div data-find-item={tool.id} className="mb-1">
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
