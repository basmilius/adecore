import { describe, expect, test } from 'bun:test';
import { formatDay } from '@adecore/ui/format';
import { formatRateDate } from './format';

describe('formatRateDate', () => {
    test('reads the bank day as a day of the region, never the day before', () => {
        expect(formatRateDate('2026-11-03')).toBe(formatDay(Date.UTC(2026, 10, 3), 'UTC'));
        expect(formatRateDate('2026-11-03')).not.toContain('2026-11-03');
    });

    test('keeps a day it cannot read as it came', () => {
        expect(formatRateDate('soon')).toBe('soon');
    });
});
