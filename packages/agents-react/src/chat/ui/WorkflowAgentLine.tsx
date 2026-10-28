import clsx from 'clsx';
import type { Ref } from 'react';
import { Bot, ChevronRight, X } from 'lucide-react';
import { workflowAgentRef, type AgentKind } from '@adecore/agent-contracts';
import { formatElapsedShort } from '@adecore/ui/format';
import { Icon, useTickingText } from '@adecore/ui';
import { AgentIcon } from '../../agents/AgentIcon';
import { workflowAgentPreview, workflowAgentTime, type WorkflowAgentState, type WorkflowAgentView } from '../logic/workflow';
import type { SubagentStep } from '../subagent-view';
import { ROW_GUTTER } from './icons';

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

/*
 * One agent of a workflow: its label, what it does or did, and its time. It opens the agent's
 * conversation when `onOpen` is given and the agent started; one still waiting has no transcript yet.
 * `selected` marks the agent whose conversation is open beside it.
 */
export function WorkflowAgentLine({
    view,
    provider,
    onOpen,
    selected,
    className,
    ref
}: {
    view: WorkflowAgentView;
    provider: AgentKind | undefined;
    onOpen?(step: SubagentStep): void;
    selected?: boolean;
    className?: string;
    ref?: Ref<HTMLButtonElement>;
}) {
    const { agent, state } = view;
    const time = workflowAgentTime(view);
    const preview = workflowAgentPreview(view);
    const agentId = agent.agentId;
    const open = onOpen !== undefined && agentId !== null ? () => onOpen({ toolUseId: workflowAgentRef(agentId), description: agent.label }) : undefined;

    return (
        <button
            ref={ref}
            data-workflow-agent={agent.index}
            aria-pressed={selected}
            className={clsx(
                '-mx-1 mb-0.5 flex w-[calc(100%+8px)] items-start gap-2 rounded-md px-1 py-1 text-left enabled:hover:bg-surface-hover',
                selected === true && 'bg-surface-active',
                className
            )}
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
