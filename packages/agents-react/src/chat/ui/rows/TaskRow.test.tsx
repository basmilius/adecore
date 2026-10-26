import { afterEach, expect, jest, test } from 'bun:test';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatSubagentItem } from '@adecore/agent-contracts';
import { createPage } from '@adecore/editor/testing';
import { formatClock } from '@adecore/ui/format';
import { ChatHostProvider } from '../../../host';
import { ChatScopeContext, type ChatScope } from '../../../scope';
import { TaskRow } from './TaskRow';

const scope = {
    id: 'task-row-test',
    keyOf: (chatId: string) => `task-row-test/${chatId}`,
    owns: (key: string) => key.startsWith('task-row-test/')
} as unknown as ChatScope;

const item = {
    id: 'subagent-item',
    kind: 'subagent',
    createdAt: 0,
    turnId: 'turn',
    toolUseId: 'call',
    description: 'Read the logs',
    subagentType: null,
    prompt: null,
    background: false,
    status: 'running',
    startedAt: 1,
    finishedAt: null,
    summary: null,
    result: null,
    usage: null,
    lastTool: null
} as unknown as ChatSubagentItem;

afterEach(() => {
    jest.useRealTimers();
});

test('a paused task says when it goes on in words that follow the day it is now', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 21, 23, 59).getTime() });
    const until = new Date(2026, 9, 22, 0, 30).getTime();
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
                <ChatScopeContext.Provider value={scope}>
                    <TaskRow item={item} task={{ status: 'open', createdAt: 1, settledAt: null, paused: { until } }} open={false} onPress={() => {}} />
                </ChatScopeContext.Provider>
            </ChatHostProvider>
        )
    );

    const tomorrow = page.host.textContent ?? '';
    expect(tomorrow).not.toContain(`Paused until ${formatClock(until)}`);

    // Past midnight the same moment is today, written as a time alone.
    await act(async () => jest.advanceTimersByTime(2 * 60_000));
    expect(page.host.textContent).toContain(`Paused until ${formatClock(until)}`);

    await act(async () => root.unmount());

    names.forEach((name, index) => {
        const descriptor = previous[index];

        if (descriptor === undefined) {
            Reflect.deleteProperty(globalThis, name);
        } else {
            Object.defineProperty(globalThis, name, descriptor);
        }
    });
});
