import { describe, expect, test } from 'bun:test';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseHTML } from 'linkedom';
import type { ChatToolItem, ChatTurnItem } from '@adecore/agent-contracts';
import { ChatScopeContext, type ChatScope } from '../../../scope';
import { TurnFoldRow, WorkGroupRow, WorkingRow, WorkRow } from './WorkRows';

const scope: ChatScope = {
    id: 'work-rows-test',
    keyOf: (chatId) => `work-rows-test/${chatId}`,
    owns: (key) => key.startsWith('work-rows-test/'),
    transport: {} as ChatScope['transport'],
    chats: {} as ChatScope['chats']
};

function render(node: ReactNode): Document {
    return parseHTML(renderToStaticMarkup(createElement(ChatScopeContext.Provider, { value: scope }, node))).document;
}

function tool(input: unknown, output: string | null, name = 'Bash'): ChatToolItem {
    return {
        id: 'call',
        kind: 'tool',
        createdAt: 1_700_000_000_000,
        turnId: 't1',
        toolUseId: 'call',
        name,
        input,
        output,
        state: 'done',
        parentToolUseId: null
    };
}

describe('WorkRow', () => {
    test('a call with neither input nor output is a line, not a button', () => {
        const document = render(createElement(WorkRow, { tool: tool({}, null, 'TodoWrite') }));
        expect(document.querySelector('button')).toBeNull();
        expect(document.querySelector('svg.lucide-chevron-right')).toBeNull();
    });

    test('a call with something to show opens, and carries its time', () => {
        const document = render(createElement(WorkRow, { tool: tool({ command: 'ls' }, 'a.txt') }));
        const button = document.querySelector('button')!;
        expect(button.querySelector('time')!.getAttribute('dateTime')).toBe(new Date(1_700_000_000_000).toISOString());
        expect(button.querySelector('time')!.getAttribute('class')).toContain('hidden');
        expect(button.querySelector('svg.lucide-chevron-right')).not.toBeNull();
    });

    test('a shell command reads the same before the highlighter is in', () => {
        const command = `python3 -c 'print(1)'`;
        const document = render(createElement(WorkRow, { tool: tool({ command }, null) }));
        expect(document.querySelector('[data-find-field="summary"]')!.textContent).toBe(command);
    });
});

describe('WorkGroupRow', () => {
    test.each(['running', 'done', 'error'] as const)('a group with a %s call shows its progress or settled summary', (state) => {
        const tools = [tool({ command: 'ls' }, null), { ...tool({ command: 'bun test' }, null), id: 'second', state }];
        const document = render(createElement(WorkGroupRow, { tools, summary: 'Ran 2 commands', expanded: false, onToggle: () => undefined }));
        const button = document.querySelector('button')!;

        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(button.textContent).toContain(state === 'running' ? '2 tool calls' : 'Ran 2 commands');
        expect(button.textContent?.includes('1 running')).toBe(state === 'running');
        expect(button.classList.contains('text-status-error')).toBe(state === 'error');
    });
});

describe('the mark of the call running last', () => {
    const running = (id: string, name: string): ChatToolItem => ({ ...tool({}, null, name), id, toolUseId: id, state: 'running' });

    test('a group wears it in the accent color, and its own mark once nothing runs', () => {
        const tools = [running('first', 'Bash'), running('second', 'Read'), { ...tool({}, null, 'Grep'), id: 'third' }];
        const live = render(createElement(WorkGroupRow, { tools, summary: '3 calls', expanded: false, onToggle: () => undefined }));
        const settled = render(createElement(WorkGroupRow, { tools: [tool({}, null, 'Read')], summary: '1 call', expanded: false, onToggle: () => undefined }));

        expect(live.querySelector('.text-accent svg.lucide-eye')).not.toBeNull();
        expect(settled.querySelector('.text-accent')).toBeNull();
        expect(settled.querySelector('svg.lucide-eye')).not.toBeNull();
    });

    test('the working row wears it too, and a spinner between calls', () => {
        const live = render(createElement(WorkingRow, { startedAt: 1_700_000_000_000, tool: running('first', 'Read') }));
        const between = render(createElement(WorkingRow, { startedAt: 1_700_000_000_000 }));

        expect(live.querySelector('.text-accent svg.lucide-eye')).not.toBeNull();
        expect(between.querySelector('.text-accent')).toBeNull();
        expect(between.querySelector('.text-status-running')).not.toBeNull();
    });
});

describe('TurnFoldRow', () => {
    const turn: ChatTurnItem = { id: 't1', kind: 'turn', createdAt: 1_700_000_000_000, turnId: 't1', state: 'done', endedAt: null, costUsd: 0 };

    test('shows when the turn started', () => {
        const document = render(
            createElement(TurnFoldRow, { turn, label: 'Worked for 2m', work: [], expanded: false, expandable: true, onToggle: () => undefined })
        );
        expect(document.querySelector('button time')).not.toBeNull();
    });

    test('a fold with nothing to open is a label, not a button', () => {
        const document = render(
            createElement(TurnFoldRow, { turn, label: 'Worked for 2m', work: ['Read 2 files'], expanded: false, expandable: false, onToggle: () => undefined })
        );

        expect(document.querySelector('button')).toBeNull();
        expect(document.querySelector('svg.lucide-chevron-right')).toBeNull();
        expect(document.documentElement.textContent).toContain('Worked for 2m · Read 2 files');
        expect(document.querySelector('time')).not.toBeNull();
    });
});
