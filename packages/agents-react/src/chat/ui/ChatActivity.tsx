import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { useShallow } from 'zustand/shallow';
import { useTranslation } from 'react-i18next';
import { Activity, MessageCircleQuestionMark, Square, SquareTerminal, TriangleAlert } from 'lucide-react';
import type { ChatBackgroundTask, ChatSubagentItem } from '@adecore/agent-contracts';
import { backgroundCounts } from '../activity';
import { badgeCountOf, entryTimeOf, flyoutSubagents, progressOf, statusWordOf, subagentTitle, summaryWordOf, taskIdOf, taskRowStateOf } from '../subagent-list';
import { useSubagentSupport } from '../subagent-support';
import { canOpenSubagent, crumbOf, openFromMain, useSubagentTrail, type SubagentStep } from '../subagent-view';
import { flyoutWorkflows, workflowPillOf, type WorkflowCall, type WorkflowWord } from '../workflow-list';
import { SubagentStopButton } from './SubagentStopButton';
import { WorkflowRow } from './rows/WorkflowRow';
import { formatElapsedShort } from '@adecore/ui/format';
import { Icon, IconButton, Popover, Surface, useNow } from '@adecore/ui';
import { useChatRow, useChats } from '../../state/chats';
import { useChatHost } from '../../host';
import { useChatScope } from '../../scope';
import { useChatActions } from '../actions';
import { statusLookOf, type StatusWord } from '../../agents/status-look';
import { useHostTask, useHostTasks } from '../../host-hooks';

const NO_TASKS: readonly ChatBackgroundTask[] = [];

const NO_ITEMS: readonly string[] = [];

const ROW_BODY = 'flex min-h-9 min-w-0 grow items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left';

/*
 * What the chat keeps working on beside the thread, in one small line over the composer: its sub-agents,
 * its workflows and what runs in the background. Without `workflows` an app shows them somewhere else.
 */
export function ChatActivity({ chatId, workflows: showsWorkflows = true }: { chatId: string; workflows?: boolean }) {
    const host = useChatHost();
    const { t } = useTranslation('agent-chat');
    const order = useChatRow(chatId, (row) => row?.order) ?? NO_ITEMS;
    const before = useChatRow(chatId, (row) => row?.subagentsBefore) ?? NO_ITEMS;
    const workflowsBefore = useChatRow(chatId, (row) => row?.workflowsBefore) ?? NO_ITEMS;
    const structure = useChatRow(chatId, (row) => row?.structure);
    const subagents = structure === undefined ? [] : flyoutSubagents([...before, ...order], structure);
    const workflows = structure === undefined || !showsWorkflows ? [] : flyoutWorkflows([...workflowsBefore, ...order], structure);
    const { id, keyOf } = useChatScope();
    const tasks = useHostTasks(id);
    // The infos of these sub-agents' own chats, so the info of any other chat changing does not draw this again.
    const children = useChats(useShallow((s) => subagents.map((item) => (item.childId === undefined ? undefined : s.statusByKey[keyOf(item.childId)]?.info))));

    const progress = progressOf(
        subagents.map((item, index) => {
            const taskId = taskIdOf(item);

            return taskRowStateOf(item, taskId === null ? null : (tasks?.[taskId] ?? null), children[index]);
        })
    );

    const words = subagents.map((item) => {
        const taskId = taskIdOf(item);

        return statusWordOf(item, taskId === null ? null : (tasks?.[taskId] ?? null));
    });

    const background = useChatRow(chatId, (row) => row?.info.background) ?? NO_TASKS;

    if (subagents.length === 0 && workflows.length === 0 && background.length === 0) {
        return null;
    }

    const { shells, monitors } = backgroundCounts(background);
    const Slot = host.SubagentSlot;
    const counting = progress.active > 0 && progress.total > 1;

    const label = counting
        ? [t('activity.progress', { done: progress.done, total: progress.total }), progress.waiting > 0 && t('activity.needsYou', { count: progress.waiting })]
              .filter(Boolean)
              .join(', ')
        : t('activity.subagents', { count: badgeCountOf(words) });

    return (
        <div className="mb-3 flex flex-wrap items-center gap-2">
            {subagents.length > 0 &&
                (Slot === null ? (
                    <Flyout
                        icon={
                            progress.waiting > 0 ? (
                                <Icon icon={MessageCircleQuestionMark} size={14} className="shrink-0 text-status-needs-you" />
                            ) : (
                                <StatusIcon word={summaryWordOf(words)} />
                            )
                        }
                        label={label}
                        heading={t('activity.subagents', { count: subagents.length })}
                    >
                        <SubagentRows chatId={chatId} items={subagents} />
                    </Flyout>
                ) : (
                    <Slot chatId={chatId} items={subagents} />
                ))}
            {workflows.length > 0 && <WorkflowFlyout chatId={chatId} calls={workflows} />}
            {background.length > 0 && (
                <Flyout
                    icon={<Icon icon={shells > 0 ? SquareTerminal : Activity} size={14} />}
                    label={[shells > 0 && t('activity.shells', { count: shells }), monitors > 0 && t('activity.monitors', { count: monitors })]
                        .filter(Boolean)
                        .join(' · ')}
                >
                    <BackgroundTaskRows chatId={chatId} tasks={background} />
                </Flyout>
            )}
        </div>
    );
}

export function StatusIcon({ word }: { word: StatusWord }) {
    const look = statusLookOf(word);

    return <Icon icon={look.icon} size={14} className={clsx('shrink-0', look.tone, look.spins && 'animate-spin')} />;
}

/* A chip that opens a list over it, headed by what the chip says unless the list counts more than the chip does. */
function Flyout({ icon, label, heading = label, children }: { icon: ReactNode; label: string; heading?: string; children: ReactNode }) {
    return (
        <Popover.Root>
            <Surface
                render={<Popover.Trigger />}
                className="pointer-events-auto inline-flex h-7.5 items-center gap-1.5 rounded-full px-3 text-xs text-text-muted tabular-nums hover:text-text"
            >
                {icon}
                {label}
            </Surface>
            <Popover.Popup side="top" className="w-80">
                <div className="px-2.5 pt-1.5 pb-1 text-xs text-text-faint">{heading}</div>
                {children}
            </Popover.Popup>
        </Popover.Root>
    );
}

function WorkflowIcon({ word }: { word: WorkflowWord }) {
    return word === 'stalled' ? <Icon icon={TriangleAlert} size={14} className="shrink-0 text-status-needs-you" /> : <StatusIcon word={word} />;
}

/* The workflows as the thread draws them, each with its phases; opening an agent shows its conversation in the thread's place. */
function WorkflowFlyout({ chatId, calls }: { chatId: string; calls: readonly WorkflowCall[] }) {
    const { t } = useTranslation('agent-chat');
    const { show } = useSubagentTrail(chatId);
    const [open, setOpen] = useState(false);
    const pill = workflowPillOf(calls);

    const openAgent = (step: SubagentStep): void => {
        setOpen(false);
        show(openFromMain(step));
    };

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Surface
                render={<Popover.Trigger />}
                className="pointer-events-auto inline-flex h-7.5 max-w-full min-w-0 items-center gap-1.5 rounded-full px-3 text-xs text-text-muted tabular-nums hover:text-text"
            >
                <WorkflowIcon word={pill.word} />
                <span className="truncate">{pill.label}</span>
                {calls.length === 1 && <span className="sr-only">, {t(`rows.workflow.${pill.word}`)}</span>}
            </Surface>
            <Popover.Popup side="top" className="w-96">
                <div className="px-2.5 pt-1.5 pb-1 text-xs text-text-faint">{t('activity.workflows', { count: calls.length })}</div>
                <div className="max-h-96 overflow-auto px-2.5 pb-1.5">
                    {calls.map((call) => (
                        <WorkflowRow key={call.id} chatId={chatId} tool={call} workflow={call.workflow} onOpenAgent={openAgent} place="flyout" />
                    ))}
                </div>
            </Popover.Popup>
        </Popover.Root>
    );
}

/* One line of a flyout; with `onOpen` the line leads somewhere and closes the flyout on the way. */
function ActivityRow({
    icon,
    title,
    detail,
    time,
    onOpen,
    children
}: {
    icon: ReactNode;
    title: ReactNode;
    detail?: string | null;
    time: string;
    onOpen?: () => void;
    children?: ReactNode;
}) {
    const body = (
        <>
            {icon}
            <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-sm text-text">{title}</span>
                {detail && <span className="truncate font-mono text-xs text-text-faint">{detail}</span>}
            </span>
            {time !== '' && <span className="shrink-0 text-xs text-text-faint tabular-nums">{time}</span>}
        </>
    );

    // The stop is a button of its own beside the line, since a button cannot hold another.
    return (
        <div className={clsx('flex items-center gap-1 rounded-md', onOpen && 'hover:bg-surface-hover')}>
            {onOpen ? (
                <Popover.Close className={ROW_BODY} onClick={onOpen}>
                    {body}
                </Popover.Close>
            ) : (
                <div className={ROW_BODY}>{body}</div>
            )}
            {children}
        </div>
    );
}

/* Only drawn while the flyout is open, so the clock ticks for nobody otherwise. */
function SubagentRows({ chatId, items }: { chatId: string; items: readonly ChatSubagentItem[] }) {
    const now = useNow(
        1000,
        items.some((item) => item.status === 'running')
    );

    return items.map((item) => <SubagentEntry key={item.id} chatId={chatId} item={item} now={now} />);
}

function SubagentEntry({ chatId, item, now }: { chatId: string; item: ChatSubagentItem; now: number }) {
    const { t } = useTranslation('agent-chat');
    const { id, keyOf } = useChatScope();
    const refused = useSubagentSupport((s) => s.unsupported[id] === true);
    const task = useHostTask(id, taskIdOf(item));
    const { show } = useSubagentTrail(chatId);
    const child = useChats((s) => (item.childId === undefined ? undefined : s.statusByKey[keyOf(item.childId)]?.info));
    const word = statusWordOf(item, task);
    const state = taskRowStateOf(item, task, child);

    return (
        <ActivityRow
            icon={<StatusIcon word={word} />}
            title={
                <>
                    {subagentTitle(item)}
                    {/* The icon says the state to the eye; a screen reader hears it with the title. */}
                    <span className="sr-only">, {state === 'waiting' ? t('rows.task.waiting') : t(`common.status.${word}`)}</span>
                </>
            }
            time={entryTimeOf(item, task, now)}
            onOpen={canOpenSubagent(item, refused) ? () => show(openFromMain(crumbOf(item))) : undefined}
        >
            <SubagentStopButton chatId={chatId} item={item} className="mr-1.5" />
        </ActivityRow>
    );
}

/* Only drawn while the flyout is open, so the clock ticks for nobody otherwise. */
function BackgroundTaskRows({ chatId, tasks }: { chatId: string; tasks: readonly ChatBackgroundTask[] }) {
    const host = useChatHost();
    const { t } = useTranslation('agent-chat');
    const now = useNow(1000);
    const actions = useChatActions();

    function stop(taskId: string): void {
        void actions.stopTask(chatId, taskId).catch((e: unknown) => {
            const description = e instanceof Error ? e.message : t('subagents.noAnswer');
            host.notify({ kind: 'error', title: t('activity.stopFailed'), description });
        });
    }

    return tasks.map((task) => (
        <ActivityRow
            key={task.id}
            icon={<Icon icon={task.kind === 'shell' ? SquareTerminal : Activity} size={14} className="shrink-0 text-text-faint" />}
            title={task.description || task.command || t(`activity.${task.kind}`)}
            detail={task.description ? task.command : null}
            time={formatElapsedShort(now - task.startedAt)}
        >
            <IconButton icon={Square} size="xs" label={t('activity.stop')} className="mr-1.5" onClick={() => stop(task.id)} />
        </ActivityRow>
    ));
}
