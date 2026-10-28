import { useState } from 'react';
import type { ChatToolItem } from '@adecore/agent-contracts';
import { liveWorkflowPhase, summarizeGroup, workflowPhases, workflowPhaseState, workflowPhaseTime } from '@adecore/agents-react/chat';
import { formatElapsedShort } from '@adecore/ui/format';
import {
    AgentTurnRow,
    CompactionRow,
    NoteRow,
    ReportRow,
    WorkGroupRow,
    WorkingRow,
    WorkRow,
    ForksRow,
    TaskRow,
    WorkflowAgentLine,
    WorkflowRow
} from '@adecore/agents-react/chat/ui';
import { NOW, chatItems, taskRows, workflowTool } from '../shared/agents-data.ts';
import { AgentDemo } from '../shared/agents.tsx';
import { DEMO_CHAT, demoChats, forkChats } from '../shared/agents-host.ts';

const tools = chatItems().filter((item): item is ChatToolItem => item.kind === 'tool');
const reads = tools.filter((tool) => tool.name === 'Read' || tool.name === 'Grep');
const workflow = workflowTool();
const tasks = taskRows();

/* A workflow's phases in a column of their own, the live one open, with the agent picked in it marked. */
function WorkflowPhases() {
    const [picked, setPicked] = useState<number | null>(null);
    const running = workflow.state === 'running';
    const phases = workflowPhases(workflow.workflow!, running);
    const live = liveWorkflowPhase(phases, running);

    return (
        <div className="flex w-80 flex-col gap-2 rounded-lg border border-border p-2">
            {phases.map((phase) => {
                const { settled, total } = workflowPhaseState(phase);
                const time = workflowPhaseTime(phase);

                return (
                    <section key={phase.key}>
                        <div className="flex h-7 min-w-0 items-center gap-2 text-xs">
                            <span className="min-w-0 grow truncate font-medium text-text">{phase.title}</span>
                            <span className="shrink-0 text-text-faint tabular-nums">
                                {settled}/{total}
                                {time !== null && time.endedAt !== null && ` · ${formatElapsedShort(time.endedAt - time.startedAt)}`}
                            </span>
                        </div>
                        {phase.key === live &&
                            phase.agents.map((view) => (
                                <WorkflowAgentLine
                                    key={view.agent.index}
                                    view={view}
                                    provider="claude"
                                    selected={picked === view.agent.index}
                                    onOpen={() => setPicked(view.agent.index)}
                                />
                            ))}
                    </section>
                );
            })}
        </div>
    );
}

function Rows() {
    const [expanded, setExpanded] = useState(false);
    const [openTask, setOpenTask] = useState<string | null>(null);

    return (
        <div className="chat-thread flex w-full max-w-2xl flex-col gap-3">
            <WorkRow tool={tools.find((tool) => tool.name === 'Bash')!} />
            <WorkGroupRow tools={reads} summary={summarizeGroup(reads)} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
            <WorkingRow startedAt={NOW - 14_000} />
            <WorkflowRow chatId={DEMO_CHAT} tool={workflow} workflow={workflow.workflow!} />
            <WorkflowPhases />
            <div>
                {tasks.map(({ item, task }) => (
                    <TaskRow
                        key={item.id}
                        item={item}
                        task={task}
                        open={openTask === item.id}
                        onPress={() => setOpenTask(openTask === item.id ? null : item.id)}
                    />
                ))}
            </div>
            <ForksRow chatId={DEMO_CHAT} turnId="turn-1" />
            <NoteRow id="note-info" level="info" text="The chat moved to the account Work." />
            <NoteRow id="note-warning" level="warning" text="The CLI restarted and resumed the conversation." />
            <NoteRow id="note-error" level="error" text="The CLI exited with code 1." />
            <CompactionRow preTokens={96_300} />
            <AgentTurnRow label="The helper agent finished" />
            <ReportRow id="report" text="Three callers: `barometer.ts` and `thermometer.ts` catch errors, `station.ts` does not." />
        </div>
    );
}

export default function RowsDemo() {
    return (
        <AgentDemo chats={() => ({ ...demoChats(), ...forkChats() })}>
            <Rows />
        </AgentDemo>
    );
}
