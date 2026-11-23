import { expect, test } from 'bun:test';
import { codexTextResetAt, codexTimeZone } from './codex-reset.ts';

// The text forms come from T3 Code (`codexMessageResetAt`); no capture of our own shows them.
const FAILED_AT = Date.UTC(2026, 10, 11, 10, 0);

test.each([
    ['today, read on the date the turn failed in that zone', 'Try again at 3:37 PM.', 'Europe/Amsterdam', Date.UTC(2026, 10, 11, 14, 38)],
    ['a date of its own', 'You hit your limit, try again at Nov 13th, 2026 9:05 AM.', 'America/New_York', Date.UTC(2026, 10, 13, 14, 6)],
    ['midnight as 12 AM', 'try again at Nov 12th, 2026 12:00 AM.', 'UTC', Date.UTC(2026, 10, 12, 0, 1)],
    ['the later instant of a repeated hour', 'try again at Oct 31st, 2027 2:30 AM.', 'Europe/Amsterdam', Date.UTC(2027, 9, 31, 1, 31)]
])('reads the reset a usage limit names: %s', (_case, message, zone, expected) => {
    expect(codexTextResetAt(message, FAILED_AT, zone)).toBe(expected);
});

test.each([
    ['no time at all', "You've hit your usage limit."],
    ['a time already past', 'Try again at 9:00 AM.'],
    ['a month it does not know', 'try again at Foo 13th, 2026 9:05 AM.']
])('names no reset for %s', (_case, message) => {
    expect(codexTextResetAt(message, FAILED_AT, 'Europe/Amsterdam')).toBeNull();
});

test('reads a named TZ with its leading colon, and the machine zone for one it does not know', () => {
    const machine = new Intl.DateTimeFormat().resolvedOptions().timeZone;

    expect(codexTimeZone(':Asia/Tokyo')).toBe('Asia/Tokyo');
    expect(codexTimeZone('Nowhere/Else')).toBe(machine);
    expect(codexTimeZone(undefined)).toBe(machine);
});
