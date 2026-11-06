import { describe, expect, test } from 'bun:test';
import { COLUMNS, ROWS, crisp } from './plane.ts';

const plot = { left: 10, top: 20, right: 210, bottom: 120, width: 200, height: 100 };

describe('the plane of columns', () => {
    test('draws a value line across the plot and a bucket line up it', () => {
        expect(COLUMNS.valueLine(plot, 50.5)).toEqual({ x1: 10, x2: 210, y1: 50.5, y2: 50.5 });
        expect(COLUMNS.bucketLine(plot, 80.5)).toEqual({ x1: 80.5, x2: 80.5, y1: 20, y2: 120 });
    });

    test('writes the label of a rule at the right end, and under the line where there is no room above it', () => {
        expect(COLUMNS.ruleLabel(plot, 60)).toEqual({ x: 210, y: 53, anchor: 'end' });
        expect(COLUMNS.ruleLabel(plot, 10)).toEqual({ x: 210, y: 17, dy: '0.8em', anchor: 'end' });
    });

    test('draws every part', () => {
        expect(['bar', 'line', 'area', 'point', 'marker', 'band', 'groups'].every((part) => COLUMNS.draws(part as 'bar'))).toBe(true);
    });
});

describe('the plane of rows', () => {
    test('draws a value line down the plot and a bucket line across it', () => {
        expect(ROWS.valueLine(plot, 50.5)).toEqual({ x1: 50.5, x2: 50.5, y1: 20, y2: 120 });
        expect(ROWS.bucketLine(plot, 80.5)).toEqual({ x1: 10, x2: 210, y1: 80.5, y2: 80.5 });
    });

    test('writes the label of a rule above the plot, on the side of the line with the room', () => {
        expect(ROWS.ruleLabel(plot, 60)).toEqual({ x: 56, y: 13, anchor: 'start' });
        expect(ROWS.ruleLabel(plot, 180)).toEqual({ x: 184, y: 13, anchor: 'end' });
    });

    test('draws the bars alone', () => {
        expect(ROWS.draws('bar')).toBe(true);
        expect(['line', 'area', 'point', 'marker', 'band', 'groups'].some((part) => ROWS.draws(part as 'line'))).toBe(false);
    });
});

test('a crisp pixel stands on the middle of a pixel', () => {
    expect(crisp(3.2)).toBe(3.5);
    expect(crisp(3.8)).toBe(4.5);
});
