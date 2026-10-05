import { describe, expect, test } from 'bun:test';
import { formatFigure } from './figure.ts';

describe('formatFigure', () => {
    test('writes a whole number without a fraction', () => {
        expect(formatFigure(39)).toBe('39');
        expect(formatFigure(0)).toBe('0');
        expect(formatFigure(1234)).toBe('1,234');
    });

    test('writes up to two decimals and drops a trailing zero', () => {
        expect(formatFigure(1.95)).toBe('1.95');
        expect(formatFigure(1234.5)).toBe('1,234.5');
        expect(formatFigure(0.05)).toBe('0.05');
        expect(formatFigure(2.999)).toBe('3');
    });

    test('keeps the sign', () => {
        expect(formatFigure(-1.25)).toBe('-1.25');
        expect(formatFigure(-0.5)).toBe('-0.5');
        expect(formatFigure(-0.001)).toBe('0');
        expect(formatFigure(-12)).toBe('-12');
    });
});
