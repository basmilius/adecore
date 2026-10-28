import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseHTML } from 'linkedom';
import type { ChatItem, ChatSubagentItem, ChatToolItem } from '@adecore/agent-contracts';
import { ChatHostProvider } from '../../../host';
import { ChatScopeContext, type ChatScope } from '../../../scope';
import { SubagentRow } from './SubagentRow';

const scope: ChatScope = {
    id: 'subagent-row-test',
    keyOf: (chatId) => `subagent-row-test/${chatId}`,
    owns: (key) => key.startsWith('subagent-row-test/'),
    transport: {} as ChatScope['transport'],
    chats: {} as ChatScope['chats']
};

const item: ChatSubagentItem = {
    id: 'agent',
    kind: 'subagent',
    createdAt: 1,
    turnId: 't1',
    toolUseId: 'agent-call',
    description: 'Look around',
    subagentType: null,
    prompt: null,
    background: false,
    status: 'done',
    startedAt: 1,
    finishedAt: 2,
    summary: null,
    result: null,
    usage: null,
    lastTool: null,
    itemsTruncated: false
};

function tool(id: string, name: string): ChatToolItem {
    return { id, kind: 'tool', createdAt: 1, turnId: 't1', toolUseId: id, name, input: {}, output: '', state: 'done', parentToolUseId: 'agent-call' };
}

function render(work: ChatItem[], hidesToolCalls: boolean): Document {
    const host = { useHidesToolCalls: () => hidesToolCalls };
    const row = createElement(SubagentRow, { chatId: 'chat', item, work, expanded: true, onToggle: () => undefined });

    return parseHTML(renderToStaticMarkup(createElement(ChatScopeContext.Provider, { value: scope }, createElement(ChatHostProvider, { host }, row)))).document;
}

describe('SubagentRow', () => {
    test("leaves its work's tool lines out when the host hides them, and keeps a generated image", () => {
        const work = [tool('read', 'Read'), tool('image', 'ImageGeneration')];
        const shown = render(work, false);
        const hidden = render(work, true);

        expect(shown.querySelector('[data-find-item="read"]')).not.toBeNull();
        expect(shown.querySelector('.overflow-y-auto')!.children.length).toBe(2);
        expect(hidden.querySelector('[data-find-item="read"]')).toBeNull();
        expect(hidden.querySelector('.overflow-y-auto')!.children.length).toBe(1);
    });

    test('says nothing about work it did when all of it was tool lines', () => {
        expect(render([tool('read', 'Read')], true).documentElement.textContent).not.toContain('Nothing to show yet.');
        expect(render([], true).documentElement.textContent).toContain('Nothing to show yet.');
    });
});
