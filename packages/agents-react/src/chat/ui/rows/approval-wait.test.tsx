import { expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatApprovalItem, ChatInfo, ChatToolItem } from '@adecore/agent-contracts';
import { createPage } from '@adecore/editor/testing';
import { ChatHostProvider } from '../../../host';
import { ApprovalBody } from '../../../prompts/ui/ApprovalBody';
import { emptyPromptDraft } from '../../../prompts/logic/prompts';
import { ChatScopeContext, type ChatScope } from '../../../scope';
import { useChats } from '../../../state/chats';
import { WorkLiveRow } from './WorkRows';

const scope = {
    id: 'approval-wait-test',
    keyOf: (chatId: string) => `approval-wait-test/${chatId}`,
    owns: (key: string) => key.startsWith('approval-wait-test/')
} as unknown as ChatScope;

const info = { chatId: 'chat', provider: 'antigravity', status: 'needs-you', activeTurnId: 'turn', background: [] } as unknown as ChatInfo;

const tool = {
    id: 'tool-item',
    kind: 'tool',
    createdAt: 0,
    turnId: 'turn',
    toolUseId: 'call',
    name: 'Bash',
    input: { command: 'ruimte-context list' },
    output: null,
    state: 'running',
    parentToolUseId: null
} as ChatToolItem;

function approvalOf(description: string | null): ChatApprovalItem {
    return {
        id: 'approval-item',
        kind: 'approval',
        createdAt: 1,
        turnId: 'turn',
        requestId: 'request',
        toolUseId: 'call',
        toolName: 'Bash',
        input: { command: 'ruimte-context list' },
        description,
        canAllowAlways: true,
        decision: 'pending'
    } as ChatApprovalItem;
}

async function render(node: ReactNode): Promise<{ text: string; done(): Promise<void> }> {
    const page = createPage();
    const fromPage = ['window', 'document', 'Node', 'Element', 'HTMLElement'] as const;
    const names = [...fromPage, 'IS_REACT_ACT_ENVIRONMENT'] as const;
    const previous = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));

    for (const name of fromPage) {
        Object.defineProperty(globalThis, name, { value: name === 'window' ? page.window : page.window[name], configurable: true });
    }

    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    const root = createRoot(page.host);

    await act(async () =>
        root.render(
            <ChatHostProvider host={{}}>
                <ChatScopeContext.Provider value={scope}>{node}</ChatScopeContext.Provider>
            </ChatHostProvider>
        )
    );

    return {
        text: page.host.textContent ?? '',
        async done() {
            await act(async () => root.unmount());
            useChats.getState().forgetWhere((key) => key.startsWith('approval-wait-test/'));

            names.forEach((name, index) => {
                const descriptor = previous[index];

                if (descriptor === undefined) {
                    Reflect.deleteProperty(globalThis, name);
                } else {
                    Object.defineProperty(globalThis, name, descriptor);
                }
            });
        }
    };
}

test('a call that waits on the person says so instead of counting the wait as running time', async () => {
    useChats.getState().reset(scope.keyOf('chat'), info, [tool, approvalOf(null)]);
    const waiting = await render(<WorkLiveRow chatId="chat" tool={tool} />);
    expect(waiting.text).toContain('waiting for you');
    expect(waiting.text).not.toContain('running for');
    await waiting.done();

    useChats.getState().reset(scope.keyOf('chat'), info, [tool, { ...approvalOf(null), decision: 'allow' } as ChatApprovalItem]);
    const running = await render(<WorkLiveRow chatId="chat" tool={tool} />);
    expect(running.text).toContain('running for');
    await running.done();
});

test('an approval leaves out a description that only repeats its command', async () => {
    const draft = emptyPromptDraft();
    const same = await render(<ApprovalBody item={approvalOf('ruimte-context list')} draft={draft} onDraft={() => {}} denyReason={false} locked={false} />);
    expect(same.text.split('ruimte-context list')).toHaveLength(2);
    await same.done();

    const own = await render(<ApprovalBody item={approvalOf('List the linked context')} draft={draft} onDraft={() => {}} denyReason={false} locked={false} />);
    expect(own.text).toContain('List the linked context');
    expect(own.text).toContain('ruimte-context list');
    await own.done();
});
