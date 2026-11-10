import { describe, expect, test } from 'bun:test';
import type { ChatBackgroundTask } from '@adecore/agent-contracts';
import { formatMoment } from '@adecore/ui/format';
import { waitingOnLabel, waitingOnOf, type WaitingOnInput } from './waiting-on';

const NOW = 60 * 60_000;

function command(id: string, startedAt: number, patch: Partial<ChatBackgroundTask> = {}): ChatBackgroundTask {
    return { id, kind: 'shell', description: '', command: `run ${id}`, startedAt, ...patch };
}

function line(input: WaitingOnInput): string | null {
    const waiting = waitingOnOf(input);

    return waiting === null ? null : waitingOnLabel(waiting, NOW);
}

describe('what a chat waits on', () => {
    const everything: WaitingOnInput = {
        children: [{ paused: { until: NOW + 60_000 } }, { child: { status: 'needs-you' } }, { child: { status: 'running', requests: [] } }],
        background: [command('late', NOW - 60_000), command('early', NOW - 12 * 60_000)],
        subagents: 2,
        workflows: 1,
        planStatus: 'Fixing the focus bug'
    };

    test('a child that needs the person comes first, by a status or an open request', () => {
        expect(line(everything)).toBe('A sub-agent needs you');
        expect(
            line({
                ...everything,
                children: [{ child: { status: 'running', requests: [{ id: 'q', kind: 'question' }] } }, { child: { status: 'needs-you' } }]
            } as WaitingOnInput)
        ).toBe('2 sub-agents need you');
    });

    test('then a paused child, until the earliest time any of them names', () => {
        const children = [{ paused: { until: NOW + 2 * 60 * 60_000 } }, { paused: {} }, { paused: { until: NOW + 60 * 60_000 } }];

        expect(line({ ...everything, children })).toBe(`A sub-agent is paused until ${formatMoment(NOW + 60 * 60_000, NOW)}`);
        expect(line({ children: [{ paused: {} }] })).toBe('A sub-agent is paused');
    });

    test('then the oldest command or monitor with its age, by its description and else its command', () => {
        expect(line({ ...everything, children: [] })).toBe('run early · 12m');
        expect(line({ background: [command('m', NOW - 5_000, { kind: 'monitor', command: null, description: 'Tail the log' })] })).toBe('Tail the log · 5s');
        expect(
            line({ background: [command('m', NOW - 5_000, { kind: 'monitor', command: 'while true; do sleep 2; done', description: 'Watch the log' })] })
        ).toBe('Watch the log · 5s');
    });

    test('then subagents and workflows in the background, counted where known', () => {
        expect(line({ subagents: 2, workflows: 1, planStatus: 'Fixing the focus bug' })).toBe('2 sub-agents in the background · 1 workflow');
        expect(line({ workflows: 1 })).toBe('1 workflow');
        expect(line({ delegating: true })).toBe('Working in the background');
    });

    test('then the status line of the plan, and nothing without any of these', () => {
        expect(line({ planStatus: ' Fixing the focus bug ' })).toBe('Fixing the focus bug');
        expect(line({ planStatus: ' ', children: [{ child: { status: 'running' } }] })).toBeNull();
        expect(line({})).toBeNull();
    });
});
