import { describe, expect, test } from 'bun:test';
import type { ChatBackgroundTask } from '@adecore/agent-contracts';
import { backgroundCounts, type ChatThreadBackgroundTask } from './activity';

function task(id: string, kind: ChatBackgroundTask['kind']): ChatBackgroundTask {
    return { id, kind, description: '', command: null, startedAt: 0 };
}

describe('chat activity', () => {
    test('splits what runs in the background into shells and monitors', () => {
        expect(backgroundCounts([task('1', 'shell'), task('2', 'monitor'), task('3', 'shell')])).toEqual({ shells: 2, monitors: 1, others: 0 });
    });

    test('counts a kind of a newer host apart instead of as a shell or a monitor', () => {
        const future = { ...task('4', 'shell'), kind: 'future-kind' as ChatThreadBackgroundTask['kind'] };

        expect(backgroundCounts([task('1', 'shell'), future])).toEqual({ shells: 1, monitors: 0, others: 1 });
    });
});
