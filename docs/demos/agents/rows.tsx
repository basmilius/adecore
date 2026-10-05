import { useState } from 'react';
import type { ChatToolItem } from '@adecore/agent-contracts';
import { summarizeGroup } from '@adecore/agents-react/chat/logic/timeline';
import { AgentTurnRow, CompactionRow, NoteRow, ReportRow } from '@adecore/agents-react/chat/ui/rows/MessageRows';
import { WorkGroupRow, WorkingRow, WorkRow } from '@adecore/agents-react/chat/ui/rows/WorkRows';
import { NOW, chatItems } from '../shared/agents-data.ts';
import { AgentDemo } from '../shared/agents.tsx';

const tools = chatItems().filter((item): item is ChatToolItem => item.kind === 'tool');
const reads = tools.filter((tool) => tool.name === 'Read' || tool.name === 'Grep');

function Rows() {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="chat-thread flex w-full max-w-2xl flex-col gap-3">
            <WorkRow tool={tools.find((tool) => tool.name === 'Bash')!} />
            <WorkGroupRow tools={reads} summary={summarizeGroup(reads)} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
            <WorkingRow startedAt={NOW - 14_000} />
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
        <AgentDemo>
            <Rows />
        </AgentDemo>
    );
}
