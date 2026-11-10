import { describe, expect, test } from 'bun:test';
import type { ChatItem } from '@adecore/agent-contracts';
import type { WakeChat } from '../chat/wake-chat.ts';
import { deliverMessageHandler, type DeliverMessageEntry } from './deliver-message.ts';
import { MAX_MESSAGE_TURNS, MESSAGE_TURN_WINDOW_MS } from './message-turns.ts';
import type { Notice } from './notice-store.ts';

const entry: DeliverMessageEntry = {
    kind: 'deliver-message',
    payload: { from: 'chat-1' },
    id: 'deliver-message-1',
    projectId: 'project',
    target: 'chat-2',
    createdAt: 1,
    attempts: 0,
    notBefore: 1
};

function notice(from: string, fromTitle: string): Notice {
    return { projectId: 'project', targetId: 'chat-2', from, fromTitle, text: 'hello', createdAt: 1 };
}

const words = {
    prompt: (count: number, notices: readonly Notice[]): string => `${count} messages above, ${notices.length} named`,
    label: (notices: readonly Notice[]): string => `From ${notices.map((one) => one.fromTitle).join(', ')}`
};

/* A queue and a chat that writes down every turn it is woken for. */
function fixture(waiting: Notice[], options: { placed?: boolean; chat?: boolean } = {}) {
    const woken: Parameters<WakeChat['wake']>[0][] = [];

    const chat: WakeChat = {
        items: () => [],
        wake: (wake) => {
            woken.push(wake);

            return true;
        }
    };

    const handler = deliverMessageHandler({
        notices: { waiting: () => waiting },
        chat: async () => (options.chat === false ? null : chat),
        placed: () => options.placed ?? true,
        words
    });

    return { woken, handler };
}

describe('deliverMessageHandler', () => {
    test('opens one turn for everything waiting, with the senders on it and the words of the host', async () => {
        const { woken, handler } = fixture([notice('chat-1', 'Lead'), notice('chat-3', 'Builder'), notice('chat-1', 'Lead')]);
        expect(await handler(entry)).toBeUndefined();
        expect(woken).toEqual([{ text: '3 messages above, 3 named', label: 'From Lead, Builder, Lead', taskIds: [], messageFrom: ['chat-1', 'chat-3'] }]);
    });

    test('opens no turn once messages opened as many as they may in the chat this hour', async () => {
        const now = 2 * MESSAGE_TURN_WINDOW_MS;
        const woken: unknown[] = [];

        const turns: ChatItem[] = Array.from({ length: MAX_MESSAGE_TURNS }, (_, i) => ({
            id: `t${i}`,
            kind: 'turn',
            createdAt: now - 1000,
            turnId: `t${i}`,
            state: 'done',
            origin: 'agent',
            messageFrom: ['chat-1'],
            endedAt: now - 500,
            costUsd: 0
        }));

        const chat: WakeChat = {
            items: () => turns,
            inTurn: () => false,
            wake: (wake) => {
                woken.push(wake);

                return true;
            }
        };

        const handler = deliverMessageHandler({
            notices: { waiting: () => [notice('chat-1', 'Lead')] },
            chat: async () => chat,
            placed: () => true,
            words,
            now: () => now
        });
        expect(await handler(entry)).toBeUndefined();
        expect(woken).toEqual([]);
    });

    test('waits while the chat is being moved to another folder, and wakes nobody yet', async () => {
        const woken: unknown[] = [];

        const chat: WakeChat = {
            items: () => [],
            relocating: () => true,
            wake: (wake) => {
                woken.push(wake);

                return true;
            }
        };

        const handler = deliverMessageHandler({ notices: { waiting: () => [notice('chat-1', 'Lead')] }, chat: async () => chat, placed: () => true, words });
        expect(await handler(entry)).toBe('wait');
        expect(woken).toEqual([]);
    });

    test('waits while an idle chat turns the wake away, and opens the turn once it takes one', async () => {
        let free = false;
        const woken: unknown[] = [];

        const chat: WakeChat = {
            items: () => [],
            inTurn: () => false,
            wake: (wake) => {
                if (free) {
                    woken.push(wake);
                }

                return free;
            }
        };

        const handler = deliverMessageHandler({ notices: { waiting: () => [notice('chat-1', 'Lead')] }, chat: async () => chat, placed: () => true, words });
        expect(await handler(entry)).toBe('wait');
        expect(woken).toEqual([]);

        free = true;
        expect(await handler(entry)).toBeUndefined();
        expect(woken).toHaveLength(1);
    });

    test('gives up on a wake a running turn turned away, since the end of that turn owes it again', async () => {
        const chat: WakeChat = { items: () => [], inTurn: () => true, wake: () => false };
        const handler = deliverMessageHandler({ notices: { waiting: () => [notice('chat-1', 'Lead')] }, chat: async () => chat, placed: () => true, words });
        expect(await handler(entry)).toBeUndefined();
    });

    test('wakes nobody when the messages were taken already, the node went or it has no thread', async () => {
        for (const { woken, handler } of [
            fixture([]),
            fixture([notice('chat-1', 'Lead')], { placed: false }),
            fixture([notice('chat-1', 'Lead')], { chat: false })
        ]) {
            expect(await handler(entry)).toBeUndefined();
            expect(woken).toEqual([]);
        }
    });
});
