import { afterEach, expect, jest, test } from 'bun:test';
import type { ChatSubagentItem } from '@adecore/agent-contracts';
import { createPage } from '@adecore/editor/testing';
import { formatClock } from '@adecore/ui/format';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatHostProvider, type HostTaskRow, type SubagentTask } from '../../../host/host';
import { ChatScopeContext, type ChatScope } from '../../../scope';
import { TaskRow, TaskRowHead } from './TaskRow';

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

const running: SubagentTask = { status: 'open', createdAt: 1, settledAt: null };

/* Draws `node` on a page of its own and hands back its text; the page's globals are put back on `close`. */
async function drawn(node: ReactNode): Promise<{ text(): string; close(): Promise<void> }> {
    const page = createPage();
    const fromPage = ['window', 'document', 'Node', 'Element', 'HTMLElement'] as const;
    const names = [...fromPage, 'IS_REACT_ACT_ENVIRONMENT'] as const;
    const previous = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));

    for (const name of fromPage) {
        Object.defineProperty(globalThis, name, { value: name === 'window' ? page.window : page.window[name], configurable: true });
    }

    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    const root = createRoot(page.host);

    await act(async () => root.render(<ChatScopeContext.Provider value={scope}>{node}</ChatScopeContext.Provider>));

    return {
        text: () => page.host.textContent ?? '',
        close: async () => {
            await act(async () => root.unmount());

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

test('a paused task says when it goes on in words that follow the day it is now', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 21, 23, 59).getTime() });
    const until = new Date(2026, 9, 22, 0, 30).getTime();

    const page = await drawn(
        <ChatHostProvider host={{}}>
            <TaskRow chatId="parent" item={item} task={{ ...running, paused: { until } }} open={false} onPress={() => {}} />
        </ChatHostProvider>
    );

    expect(page.text()).not.toContain(`Paused until ${formatClock(until)}`);

    // Past midnight the same moment is today, written as a time alone.
    await act(async () => jest.advanceTimersByTime(2 * 60_000));
    expect(page.text()).toContain(`Paused until ${formatClock(until)}`);

    await page.close();
});

test("a host's own row takes the place of the task's row, with what the row stands on", async () => {
    const asked: HostTaskRow[] = [];

    const page = await drawn(
        <ChatHostProvider
            host={{
                useTaskRow: (row) => {
                    asked.push(row);

                    return <p>Drawn by the host</p>;
                }
            }}
        >
            <TaskRow chatId="parent" item={item} task={running} open={false} onPress={() => {}} />
        </ChatHostProvider>
    );

    expect(page.text()).toBe('Drawn by the host');
    expect(asked.at(-1)).toMatchObject({ scopeId: 'task-row-test', chatId: 'parent', item, task: running, state: 'running', open: false });

    await page.close();
});

test('a host that answers null keeps the standard row, and so does a host without the hook', async () => {
    for (const host of [{ useTaskRow: () => null }, {}]) {
        const page = await drawn(
            <ChatHostProvider host={host}>
                <TaskRow chatId="parent" item={item} task={running} open={false} onPress={() => {}} />
            </ChatHostProvider>
        );

        expect(page.text()).toContain('Read the logs');

        await page.close();
    }
});

test('the head of a row says what the host knows the agent does now in place of its state', async () => {
    const page = await drawn(<TaskRowHead item={item} task={running} open={false} onPress={() => {}} line="Writing Sign up.html" />);

    expect(page.text()).toContain('Read the logs');
    expect(page.text()).toContain('Writing Sign up.html');

    await page.close();
});
