import type { ChatItem } from '@adecore/agent-contracts';
import { isRecord } from '@adecore/utils/record';
import { CodexProtocol } from '../backends/codex-protocol.ts';
import { readingThread, settledReading } from './subagent-projection.ts';

function userText(content: unknown): string {
    return Array.isArray(content)
        ? content
              .filter(isRecord)
              .map((block) => (typeof block.text === 'string' ? block.text : ''))
              .filter((text) => text !== '')
              .join('\n')
        : '';
}

/*
 * Items of a Codex thread, oldest first, through the mapping the live stream uses. Every entry is
 * projected on its own: consecutive reasoning would otherwise become one thinking item whose id
 * depends on where a page happened to start, and a client merging two reads by id would show that
 * thought twice.
 */
export function projectCodexItems(entriesOldestFirst: Record<string, unknown>[], now: number): ChatItem[] {
    const { thread, projector } = readingThread('Codex', () => now);
    const protocol = new CodexProtocol(0);

    for (const entry of entriesOldestFirst) {
        const item = isRecord(entry.item) ? entry.item : null;

        if (!item || typeof item.id !== 'string') {
            continue;
        }

        projector.reset();

        if (item.type === 'userMessage') {
            const text = userText(item.content);

            if (text !== '') {
                thread.upsert({ id: `user-${item.id}`, kind: 'user', createdAt: now, turnId: null, text });
            }

            continue;
        }

        for (const event of protocol.handle({ method: 'item/completed', params: { item } })) {
            projector.project(0, event);
        }
    }

    return thread.list().map(settledReading);
}
