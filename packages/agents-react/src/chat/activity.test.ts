import { describe, expect, test } from 'bun:test';
import { scheduledWakeupId, type ChatBackgroundTask } from '@adecore/agent-contracts';
import { formatMoment } from '@adecore/ui/format';
import { backgroundCounts, backgroundTaskName, backgroundTaskTime, type ChatThreadBackgroundTask } from './activity';

function task(id: string, kind: ChatBackgroundTask['kind']): ChatBackgroundTask {
    return { id, kind, description: '', command: null, startedAt: 0 };
}

describe('chat activity', () => {
    test('splits what runs in the background into shells and monitors', () => {
        expect(backgroundCounts([task('1', 'shell'), task('2', 'monitor'), task('3', 'shell')])).toEqual({ shells: 2, monitors: 1, wakeups: 0, others: 0 });
    });

    test('counts a kind of a newer host apart instead of as a shell or a monitor', () => {
        const future = { ...task('4', 'shell'), kind: 'future-kind' as ChatThreadBackgroundTask['kind'] };

        expect(backgroundCounts([task('1', 'shell'), future])).toEqual({ shells: 1, monitors: 0, wakeups: 0, others: 1 });
    });

    test('a wakeup the CLI scheduled is counted apart from monitors and reads when it fires', () => {
        const wakeup = { ...task(scheduledWakeupId('toolu_w', 90_000), 'monitor'), description: 'Scheduled wakeup' };

        expect(backgroundCounts([task('1', 'monitor'), wakeup])).toEqual({ shells: 0, monitors: 1, wakeups: 1, others: 0 });
        expect(backgroundTaskName(wakeup)).toBe('Scheduled wakeup');
        expect(backgroundTaskTime(wakeup, 30_000)).toBe(`wakes at ${formatMoment(90_000, 30_000)}`);
        expect(backgroundTaskTime({ ...task('2', 'shell'), startedAt: 25_000 }, 30_000)).toBe('5s');
    });
});
