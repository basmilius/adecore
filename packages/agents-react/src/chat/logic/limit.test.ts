import { expect, test } from 'bun:test';
import { formatMoment } from '@adecore/ui/format';
import { limitView } from './limit';

const NOW = new Date(2026, 8, 24, 12, 0).getTime();
const LATER = new Date(2026, 8, 24, 15, 0).getTime();
const at = formatMoment(LATER, NOW);

test('a usage limit says when it resets, and once a resume is owed when the chat goes on', () => {
    expect(limitView({ limit: { kind: 'usage', resetsAt: LATER }, activeTurnId: null }, NOW)).toEqual({
        pill: `Limited until ${at}`,
        title: 'Stopped on a usage limit',
        detail: `The limit resets at ${at}.`
    });

    expect(limitView({ limit: { kind: 'usage', resetsAt: LATER }, resumeAt: LATER, activeTurnId: null }, NOW)).toMatchObject({
        pill: `Resumes ${at}`,
        detail: `Resumes at ${at}.`
    });

    expect(limitView({ limit: { kind: 'usage' }, activeTurnId: null }, NOW)).toMatchObject({ pill: 'Limited', detail: null });
});

test('a usage limit whose reset has passed no longer says limited until', () => {
    expect(limitView({ limit: { kind: 'usage', resetsAt: NOW }, activeTurnId: null }, LATER)).toEqual({
        pill: 'Limit reset',
        title: 'Stopped on a usage limit',
        detail: 'The limit has reset. Send a message to go on.'
    });
});

test('an overload says when it tries again, or that a message does', () => {
    expect(limitView({ limit: { kind: 'overload' }, activeTurnId: null }, NOW)).toMatchObject({ pill: 'Overloaded', detail: 'Send a message to try again.' });

    expect(limitView({ limit: { kind: 'overload' }, resumeAt: LATER, activeTurnId: null }, NOW)).toMatchObject({
        pill: `Retry ${at}`,
        detail: `Retries at ${at}.`
    });
});

test('a limit of a kind a newer host knows says only that the turn stopped', () => {
    const limit = { kind: 'future-limit', resetsAt: LATER } as unknown as { kind: 'usage'; resetsAt: number };

    expect(limitView({ limit, activeTurnId: null }, NOW)).toEqual({ pill: 'Stopped', title: 'Stopped on a limit', detail: null });
});

test('nothing while the last turn stopped on nothing, or while a turn runs', () => {
    expect(limitView({ activeTurnId: null }, NOW)).toBeNull();
    expect(limitView({ limit: { kind: 'overload' }, activeTurnId: 'turn-2' }, NOW)).toBeNull();
});
