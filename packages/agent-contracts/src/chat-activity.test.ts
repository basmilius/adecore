import { describe, expect, test } from 'bun:test';
import { chatActivity } from './chat.ts';

const idle = { status: 'idle', activeTurnId: null } as const;

describe('chatActivity', () => {
    test('a chat that asks a person is waiting, even with a turn open', () => {
        expect(chatActivity({ status: 'needs-you', activeTurnId: 't1', delegating: true })).toBe('waiting');
    });

    test('a turn in flight is work', () => {
        expect(chatActivity({ status: 'running', activeTurnId: 't1' })).toBe('working');
        expect(chatActivity({ ...idle, activeTurnId: 't1' })).toBe('working');
    });

    test('subagents still at work keep an idle chat busy, ahead of its background commands', () => {
        expect(chatActivity({ ...idle, delegating: true, background: [{ id: 'b', kind: 'command', command: 'sleep 9', startedAt: 0 }] as never })).toBe(
            'delegating'
        );
    });

    test('only background commands, an open request, an active goal or a queue still hold a chat', () => {
        expect(chatActivity({ ...idle, background: [{ id: 'b', kind: 'command', command: 'sleep 9', startedAt: 0 }] as never })).toBe('background');
        expect(chatActivity({ ...idle, requests: [{ requestId: 'r' }] as never })).toBe('holding');
        expect(chatActivity({ ...idle, goal: { status: 'active', objective: 'x' } as never })).toBe('holding');
        expect(chatActivity({ ...idle, queue: [{ id: 'q' }] as never })).toBe('holding');
    });

    test('a chat with none of that is settled', () => {
        expect(chatActivity(idle)).toBe('settled');
        expect(chatActivity({ ...idle, goal: { status: 'paused', objective: 'x' } as never })).toBe('settled');
    });
});
