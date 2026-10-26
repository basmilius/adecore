import { describe, expect, test } from 'bun:test';
import { matchScore } from './match.ts';

describe('matchScore', () => {
    test('ranks a prefix over a word start over every word over letters in order', () => {
        const ranked = ['Toggle the sidebar', 'Slide deck', 'Sidebar on the left', 'Sign out'].sort(
            (first, second) => (matchScore(second, 'side') ?? -1) - (matchScore(first, 'side') ?? -1)
        );

        expect(ranked).toEqual(['Sidebar on the left', 'Toggle the sidebar', 'Slide deck', 'Sign out']);
        expect(matchScore('Sign out', 'side')).toBeNull();
        expect(matchScore('Sidebar on the left', 'side')).toBe(5);
        expect(matchScore('Toggle the sidebar', 'side')).toBe(4);
        expect(matchScore('Toggle the sidebar', 'bar side')).toBe(2);
        expect(matchScore('Theme of the system', 'thsy')).toBe(1);
    });

    test('ranks every word over every word when the text starts with the first one', () => {
        expect(matchScore('Theme: dark mode', 'theme dark')).toBe(3);
        expect(matchScore('Dark theme', 'theme dark')).toBe(2);
    });

    test('ignores case and the spaces around the query', () => {
        expect(matchScore('Dark theme', '  DARK ')).toBe(5);
    });

    test('takes a slash, a dot or a dash as the start of a word', () => {
        expect(matchScore('src/shell/palette.ts', 'palette')).toBe(4);
        expect(matchScore('read-only', 'only')).toBe(4);
    });

    test('says null when the letters are not in the text in order', () => {
        expect(matchScore('Sign out', 'tuo')).toBeNull();
        expect(matchScore('Sign out', 'signs')).toBeNull();
    });

    test('lets an empty query match everything alike', () => {
        expect(matchScore('Anything', '')).toBe(0);
        expect(matchScore('Anything', '   ')).toBe(0);
    });
});
