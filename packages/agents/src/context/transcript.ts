import {
    workflowAgentRef,
    type ChatApprovalDecision,
    type ChatItem,
    type ChatQuestion,
    type ChatQuestionItem,
    type ChatWorkflow,
    type ChatWorkflowAgent
} from '@adecore/agent-contracts';
import { readableAssistantText } from '../chat/readable-text.ts';

/* The first line of a subagent's report that says something, which is all a line about it has room for. */
function firstLine(text: string | null): string {
    return (
        (text ?? '')
            .split('\n')
            .find((line) => line.trim() !== '')
            ?.trim() ?? ''
    );
}

/* The request id stays on a request that no longer waits, so the state beside it is what tells a parent not to answer it. */
const QUESTION_STATES: Record<ChatQuestionItem['state'], string> = {
    pending: 'waits for an answer',
    answered: 'answered',
    cancelled: 'cancelled',
    dismissed: 'dismissed'
};

const APPROVAL_STATES: Record<ChatApprovalDecision, string> = {
    pending: 'waits for a person',
    allow: 'allowed',
    'allow-always': 'allowed always',
    deny: 'denied',
    cancelled: 'cancelled'
};

function pendingQuestionLine(question: ChatQuestion): string {
    const how =
        question.choices.length === 0
            ? 'answer in your own words'
            : `choices ${question.choices.map((choice) => choice.label).join(' | ')}${question.multiSelect ? ', one or more' : ''}, or your own words`;

    return `- question ${question.id}: ${how}`;
}

/* An agent of a workflow, by the id `subagent` reads its conversation under. */
function workflowAgentText(agent: ChatWorkflowAgent): string {
    return `${agent.label} (${agent.status}, ${agent.agentId === null ? 'not started yet' : workflowAgentRef(agent.agentId)})`;
}

/* What a Workflow call runs, one line per phase, so a parent can follow a child's workflow without opening it. */
function workflowLines(workflow: ChatWorkflow): string[] {
    const inPhase = (index: number): ChatWorkflowAgent[] => workflow.agents.filter((agent) => agent.phaseIndex === index);
    const phases = workflow.phases.map((phase) => {
        const agents = inPhase(phase.index);

        return `- phase ${phase.index} "${phase.title}": ${agents.length === 0 ? 'not started yet' : agents.map(workflowAgentText).join(', ')}`;
    });

    const loose = workflow.agents.filter((agent) => !workflow.phases.some((phase) => phase.index === agent.phaseIndex));

    return [
        `Workflow${workflow.name === null ? '' : ` "${workflow.name}"`}, each agent readable with subagent and the id beside it:`,
        ...phases,
        ...(loose.length === 0 ? [] : [`- outside a phase: ${loose.map(workflowAgentText).join(', ')}`])
    ];
}

/** Renders a thread without attributing nested subagent activity to its parent. */
export function renderTranscript(items: readonly ChatItem[]): string {
    const lines: string[] = [];

    for (const item of items) {
        if ((item.kind === 'tool' || item.kind === 'assistant') && item.parentToolUseId) {
            continue;
        }

        switch (item.kind) {
            case 'subagent': {
                const report = firstLine(item.result ?? item.summary);
                lines.push(`> Subagent "${item.description}" (${item.status}, ${item.toolUseId})${report ? `: ${report}` : ''}`, '');

                break;
            }
            case 'user':
                lines.push('## User', '');

                if (item.uiChoice) {
                    lines.push(`Chose ${JSON.stringify(item.uiChoice.label)}`, '');
                }

                lines.push(item.text, '');

                break;
            case 'assistant':
                if (item.text.trim() !== '') {
                    lines.push('## Assistant', '', readableAssistantText(item), '');
                }

                break;
            case 'tool': {
                const input = typeof item.input === 'object' && item.input !== null ? JSON.stringify(item.input) : String(item.input ?? '');
                lines.push(`> Tool ${item.name} (${item.state}): ${input.slice(0, 300)}`);

                if (item.workflow !== undefined) {
                    lines.push(...workflowLines(item.workflow));
                }

                if (item.output) {
                    lines.push('', '```', item.output.slice(0, 2000), '```', '');
                }

                break;
            }
            case 'question': {
                const answers = item.answers ? ` -> ${Object.values(item.answers).join(', ')}` : '';
                lines.push(
                    `> Question (${QUESTION_STATES[item.state]}, request ${item.requestId}): ${item.questions.map((question) => question.question).join(' / ')}${answers}`
                );

                if (item.state === 'pending') {
                    lines.push(...item.questions.map(pendingQuestionLine));
                }

                lines.push('');

                break;
            }
            case 'approval':
                lines.push(
                    `> Approval (${APPROVAL_STATES[item.decision]}, request ${item.requestId}): ${item.toolName}${item.description ? `: ${item.description}` : ''}`,
                    ''
                );

                break;
            case 'note':
                lines.push(`> ${item.text}`, '');

                break;
            default:
                break;
        }
    }

    return lines.join('\n').trim();
}
