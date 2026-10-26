import { expect, test } from 'bun:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatApprovalItem, ChatSubagentResult } from '@adecore/agent-contracts';
import { ChatScopeContext, type ChatScope } from '../../scope';
import type { ChatTransport } from '../../transport';
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
