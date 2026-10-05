import { describe, expect, test } from 'bun:test';
import { pageBounds } from './paging.ts';

describe('pageBounds', () => {
    test('a first page with more rows beyond it has an unknown total of at least one more', () => {
        expect(pageBounds(0, 500, true, null)).toEqual({ from: 1, to: 500, total: 501, exact: false, hasPrevious: false, hasNext: true });
    });

    test('a last page without more rows knows the total', () => {
        expect(pageBounds(500, 120, false, null)).toEqual({ from: 501, to: 620, total: 620, exact: true, hasPrevious: true, hasNext: false });
    });

    test('a counted total is exact and decides whether there is a next page', () => {
        expect(pageBounds(0, 500, true, 1200)).toMatchObject({ total: 1200, exact: true, hasNext: true });
        expect(pageBounds(1000, 200, false, 1200)).toMatchObject({ exact: true, hasNext: false });
    });

    test('an empty page has no range', () => {
        expect(pageBounds(0, 0, false, null)).toMatchObject({ from: 0, to: 0, total: 0, exact: true });
    });
});
