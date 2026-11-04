import { describe, expect, test } from 'bun:test';
import type { ChatItem, ChatWorkflowAgent } from '@adecore/agent-contracts';
import { compileUi } from '@adecore/intelligent-ui';
import { renderTranscript } from './transcript.ts';

const items: ChatItem[] = [
    { id: 'u', kind: 'user', createdAt: 1, turnId: 't', text: 'fix the bug' },
    {
        id: 'tool',
        kind: 'tool',
        createdAt: 2,
        turnId: 't',
        toolUseId: 'tool',
        name: 'Bash',
        input: { command: 'ls' },
        output: 'a.ts',
        state: 'done',
        parentToolUseId: null
    },
    { id: 'a', kind: 'assistant', createdAt: 3, turnId: 't', text: 'Done.', streaming: false }
];

describe('renderTranscript', () => {
    test('reads like a conversation with the tool calls in between', () => {
        const text = renderTranscript(items);
        expect(text).toContain('## User');
        expect(text).toContain('> Tool Bash (done): {"command":"ls"}');
        expect(text).toContain('a.ts');
        expect(text.endsWith('Done.')).toBe(true);
    });

    test('caps tool details before they reach another agent', () => {
        const transcript = renderTranscript([
            {
                id: 'tool',
                kind: 'tool',
                createdAt: 1,
                turnId: null,
                toolUseId: 'tool',
                name: 'Read',
                input: 'i'.repeat(301),
                output: 'o'.repeat(2001),
                state: 'done',
                parentToolUseId: null
            }
        ]);

        expect(transcript).toBe(`> Tool Read (done): ${'i'.repeat(300)}\n\n\`\`\`\n${'o'.repeat(2000)}\n\`\`\``);
    });

    test('a subagent is one line, and nothing it did reads as if the parent did it', () => {
        const text = renderTranscript([
            { id: 'u', kind: 'user', createdAt: 1, turnId: 't', text: 'look around' },
            {
                id: 'sub',
                kind: 'subagent',
                createdAt: 2,
                turnId: 't',
                toolUseId: 'toolu_1',
                description: 'Survey the docs',
                subagentType: null,
                prompt: 'Survey',
                background: false,
                status: 'done',
                startedAt: 2,
                finishedAt: 3,
                summary: null,
                result: '\nA guide is missing.\nAnd more.',
                usage: null,
                lastTool: null,
                itemsTruncated: false
            },
            {
                id: 'child-tool',
                kind: 'tool',
                createdAt: 2,
                turnId: 't',
                toolUseId: 'child-tool',
                name: 'Glob',
                input: { pattern: 'docs/**' },
                output: 'docs/README.md',
                state: 'done',
                parentToolUseId: 'toolu_1'
            },
            { id: 'child-text', kind: 'assistant', createdAt: 2, turnId: 't', text: 'A guide is missing.', streaming: false, parentToolUseId: 'toolu_1' },
            { id: 'a', kind: 'assistant', createdAt: 3, turnId: 't', text: 'The docs need a guide.', streaming: false }
        ]);
        expect(text.split('\n').filter((line) => line.startsWith('> '))).toEqual(['> Subagent "Survey the docs" (done, toolu_1): A guide is missing.']);
        expect(text).not.toContain('Glob');
        expect(text.match(/A guide is missing\./g)).toHaveLength(1);
    });

    test('a Workflow row lists each phase with its agents, their state and the id a subagent read takes', () => {
        const workflow = (name: string | null, agents: ChatWorkflowAgent[]): ChatItem => ({
            id: 'wf',
            kind: 'tool',
            createdAt: 1,
            turnId: 't',
            toolUseId: 'toolu_wf',
            name: 'Workflow',
            input: { script: 'export const meta = { name: "write-and-read" }' },
            output: null,
            state: 'running',
            parentToolUseId: null,
            workflow: {
                name,
                phases: [
                    { index: 1, title: 'Write' },
                    { index: 2, title: 'Read' },
                    { index: 3, title: 'Check' }
                ],
                agents
            }
        });
        const agent = (
            index: number,
            label: string,
            phaseIndex: number | null,
            agentId: string | null,
            status: ChatWorkflowAgent['status']
        ): ChatWorkflowAgent => ({
            index,
            label,
            phaseIndex,
            agentId,
            status,
            startedAt: null,
            durationMs: null,
            lastTool: null
        });
        const text = renderTranscript([
            workflow('write-and-read', [
                agent(1, 'write-file', 1, 'a-writer', 'done'),
                agent(2, 'read-file', 2, 'a-reader', 'running'),
                agent(3, 'read-again', 2, null, 'running'),
                agent(4, 'tidy', null, 'a-tidy', 'failed')
            ])
        ]);
        expect(text.split('\n').slice(1)).toEqual([
            'Workflow "write-and-read", each agent readable with subagent and the id beside it:',
            '- phase 1 "Write": write-file (done, workflow-agent:a-writer)',
            '- phase 2 "Read": read-file (running, workflow-agent:a-reader), read-again (running, not started yet)',
            '- phase 3 "Check": not started yet',
            '- outside a phase: tidy (failed, workflow-agent:a-tidy)'
        ]);
        expect(renderTranscript([workflow(null, [])]).split('\n')[1]).toBe('Workflow, each agent readable with subagent and the id beside it:');
    });
});

describe('a request in a thread', () => {
    const question = (state: 'pending' | 'answered', answers: Record<string, string> | null): ChatItem => ({
        id: 'question-req-1',
        kind: 'question',
        createdAt: 1,
        turnId: 't',
        requestId: 'req-1',
        questions: [
            {
                id: 'color',
                header: 'Color',
                question: 'Welke kleur?',
                choices: [
                    { label: 'Rood', description: '' },
                    { label: 'Blauw', description: 'the calm one' }
                ],
                multiSelect: false
            },
            { id: 'name', header: 'Name', question: 'Which name?', choices: [], multiSelect: false }
        ],
        answers,
        state
    });

    const approval = (decision: 'pending' | 'allow'): ChatItem => ({
        id: 'approval-req-2',
        kind: 'approval',
        createdAt: 2,
        turnId: 't',
        requestId: 'req-2',
        toolUseId: 'toolu_9',
        toolName: 'Write',
        input: { file_path: 'a.ts' },
        description: 'Write a.ts',
        canAllowAlways: false,
        decision
    });

    test('a waiting question shows its request id, and the question ids and choices answer takes', () => {
        expect(renderTranscript([question('pending', null)])).toBe(
            [
                '> Question (waits for an answer, request req-1): Welke kleur? / Which name?',
                '- question color: choices Rood | Blauw, or your own words',
                '- question name: answer in your own words'
            ].join('\n')
        );
    });

    test('an answered question keeps its id and says it was answered, with nothing left to pick', () => {
        expect(renderTranscript([question('answered', { color: 'Blauw', name: 'Kees' })])).toBe(
            '> Question (answered, request req-1): Welke kleur? / Which name? -> Blauw, Kees'
        );
    });

    test('an approval shows its request id and who it waits for, and what came of it', () => {
        expect(renderTranscript([approval('pending')])).toBe('> Approval (waits for a person, request req-2): Write: Write a.ts');
        expect(renderTranscript([approval('allow')])).toBe('> Approval (allowed, request req-2): Write: Write a.ts');
    });
});

test('reading an assistant UI block returns its fallback between the surrounding prose', () => {
    const text = 'Before\n```panel\n<Summary>Readable result</Summary>\n```\nAfter';
    const item: ChatItem = {
        id: 'reply',
        kind: 'assistant',
        createdAt: 1,
        turnId: null,
        text,
        streaming: false,
        ui: compileUi(text, { id: 'reply', final: true, fenceLanguage: 'panel', now: () => 0 })
    };
    const transcript = renderTranscript([item]);
    expect(transcript).toContain('Before');
    expect(transcript).toContain('Readable result');
    expect(transcript).toContain('After');
    expect(transcript).not.toContain('panel');
    expect(transcript).not.toContain('<Summary>');
});

test('a transcript retains the intent of a chosen UI action without changing the visible message', () => {
    const item: ChatItem = {
        id: 'user-choice',
        kind: 'user',
        createdAt: 2,
        turnId: 'turn',
        text: 'The selected files',
        uiChoice: { itemId: 'reply', blockId: 'block', revision: 'revision', choiceId: 'choice', label: 'Fix errors', sourceAt: 1, older: false, at: 2 }
    };
    expect(renderTranscript([item])).toContain('Chose "Fix errors"\n\nThe selected files');
    expect(item.text).toBe('The selected files');
});
