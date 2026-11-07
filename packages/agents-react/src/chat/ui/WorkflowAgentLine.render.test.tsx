import { afterEach, beforeEach, expect, test } from 'bun:test';
import type { ChatWorkflowAgent } from '@adecore/agent-contracts';
import { createPage } from '@adecore/editor/testing';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { WorkflowAgentView } from '../logic/workflow';
import { WorkflowAgentLine } from './WorkflowAgentLine';

const FROM_PAGE = ['window', 'document', 'Node', 'Element', 'HTMLElement'] as const;
const NAMES = [...FROM_PAGE, 'IS_REACT_ACT_ENVIRONMENT'] as const;

let page: ReturnType<typeof createPage>;
let root: Root;
let previous: (PropertyDescriptor | undefined)[];

beforeEach(() => {
    page = createPage();
    previous = NAMES.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));

    for (const name of FROM_PAGE) {
        Object.defineProperty(globalThis, name, { value: name === 'window' ? page.window : page.window[name], configurable: true });
    }

    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    root = createRoot(page.host);
});

afterEach(async () => {
    await act(async () => root.unmount());

    NAMES.forEach((name, index) => {
        const descriptor = previous[index];

        if (descriptor === undefined) {
            Reflect.deleteProperty(globalThis, name);
        } else {
            Object.defineProperty(globalThis, name, descriptor);
        }
    });
});

function viewOf(agentId: string | null): WorkflowAgentView {
    const agent: ChatWorkflowAgent = {
        index: 0,
        label: 'Review',
        phaseIndex: null,
        agentId,
        status: 'running',
        startedAt: null,
        durationMs: null,
        lastTool: null
    };

    return { agent, state: agentId === null ? 'waiting' : 'running' };
}

async function draw(view: WorkflowAgentView, onOpen?: () => void): Promise<HTMLButtonElement> {
    await act(async () => root.render(<WorkflowAgentLine view={view} provider={undefined} onOpen={onOpen} />));

    return page.host.querySelector('button')!;
}

const arrow = () => page.host.querySelector('.lucide-chevron-right');

test('a line that opens draws the arrow and opens its agent on a press', async () => {
    const opened: string[] = [];
    const button = await draw(viewOf('agent-1'), () => opened.push('open'));

    expect(arrow()).not.toBeNull();
    expect(button.disabled).toBe(false);

    await act(async () => button.click());

    expect(opened).toEqual(['open']);
});

test('a line whose agent still waits draws no arrow', async () => {
    const button = await draw(viewOf(null), () => {});

    expect(arrow()).toBeNull();
    expect(button.disabled).toBe(true);
});

test('a line without an open draws no arrow', async () => {
    const button = await draw(viewOf('agent-1'));

    expect(arrow()).toBeNull();
    expect(button.disabled).toBe(true);
});
