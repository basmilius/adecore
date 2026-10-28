import { expect, test } from 'bun:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { workflowAgentRef, type ChatApprovalItem, type ChatSubagentResult } from '@adecore/agent-contracts';
import { ChatScopeContext, type ChatScope } from '../../scope';
import type { ChatTransport } from '../../transport';
import { MAIN_AGENT, useSubagentView, type SubagentStep } from '../subagent-view';
import { SubagentTimeline } from './SubagentTimeline';

const approval: ChatApprovalItem = {
    id: 'approval-request',
    kind: 'approval',
    createdAt: 1,
    turnId: null,
    requestId: 'request',
    toolUseId: null,
    toolName: 'Bash',
    input: { command: 'cp -R source scripts' },
    description: null,
    canAllowAlways: false,
    decision: 'pending'
};

test.skipIf(typeof document === 'undefined')('a child transcript leaves its waiting prompts to the main composer', async () => {
    const requests: Array<{ type: string; payload: unknown }> = [];

    const page: ChatSubagentResult = {
        items: [{ kind: 'note', id: 'working', createdAt: 0, turnId: null, level: 'info', text: 'Reviewing the changes' }],
        pending: [approval],
        history: { start: 0, cursor: null },
        source: 'claude-transcript',
        context: { provider: 'claude', cwd: '/child', chatId: 'hidden-child' },
        live: true
    };

    const transport = {
        status: 'open',
        request: async (type: string, payload: unknown) => {
            requests.push({ type, payload });

            return type === 'chat.subagent' ? page : {};
        },
        on: () => () => {},
        subscribeStatus: () => () => {}
    } as ChatTransport;

    const scope: ChatScope = {
        id: 'child-approval-test',
        keyOf: (id) => `child-approval-test/${id}`,
        owns: (key) => key.startsWith('child-approval-test/'),
        transport,
        chats: {} as ChatScope['chats']
    };

    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);

    try {
        await act(async () => {
            root.render(createElement(ChatScopeContext.Provider, { value: scope }, createElement(SubagentTimeline, { chatId: 'parent', toolUseId: 'task' })));
        });

        expect(element.textContent).toContain('Reviewing the changes');
        expect(element.querySelector('.prompt-card')).toBeNull();
        expect(requests.filter((request) => request.type === 'chat.approve')).toEqual([]);
    } finally {
        await act(async () => {
            root.unmount();
        });

        element.remove();
    }
});

test.skipIf(typeof document === 'undefined')('drawn beside the chat it leaves out the way back and opens a child in a trail of its own', async () => {
    const page: ChatSubagentResult = {
        items: [
            {
                kind: 'tool',
                id: 'nested',
                createdAt: 0,
                turnId: null,
                toolUseId: 'nested',
                name: 'Workflow',
                input: {},
                output: null,
                state: 'running',
                parentToolUseId: null,
                workflow: {
                    name: 'nested review',
                    phases: [],
                    agents: [{ index: 0, label: 'reader', phaseIndex: null, agentId: 'a1', status: 'running', startedAt: 0, durationMs: null, lastTool: null }]
                }
            }
        ],
        pending: [],
        history: { start: 0, cursor: null },
        source: 'claude-transcript',
        live: true
    };

    const transport = {
        status: 'open',
        request: async (type: string) => (type === 'chat.subagent' ? page : {}),
        on: () => () => {},
        subscribeStatus: () => () => {}
    } as ChatTransport;

    const scope: ChatScope = {
        id: 'beside-test',
        keyOf: (id) => `beside-test/${id}`,
        owns: (key) => key.startsWith('beside-test/'),
        transport,
        chats: {} as ChatScope['chats']
    };

    const opened: SubagentStep[] = [];
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);

    try {
        await act(async () => {
            root.render(
                createElement(
                    ChatScopeContext.Provider,
                    { value: scope },
                    createElement(SubagentTimeline, {
                        chatId: 'parent',
                        toolUseId: 'task',
                        info: false,
                        onOpenConversation: (step: SubagentStep) => opened.push(step)
                    })
                )
            );
        });

        expect(element.querySelector('section')).toBeNull();

        await act(async () => {
            element.querySelector<HTMLButtonElement>('[data-workflow-agent="0"]')!.click();
        });

        expect(opened).toEqual([{ toolUseId: workflowAgentRef('a1'), description: 'reader' }]);
        expect(useSubagentView.getState().trails['beside-test/parent'] ?? MAIN_AGENT).toEqual(MAIN_AGENT);
    } finally {
        await act(async () => {
            root.unmount();
        });

        element.remove();
    }
});
