import { describe, expect, test } from 'bun:test';
import i18next from 'i18next';
import { placeholderHints } from './placeholder';

const t = i18next.getFixedT('en', 'agent-chat');

const all = { mentionable: true, referable: true, hasSkills: true };

describe('placeholderHints', () => {
    test('names views under # between files and skills', () => {
        expect(placeholderHints(t, all)).toEqual([
            { key: '/', label: 'commands' },
            { key: '@', label: 'files' },
            { key: '#', label: 'views' },
            { key: '$', label: 'skills' }
        ]);
    });

    test('leaves # out where the picker offers no views', () => {
        expect(placeholderHints(t, { ...all, referable: false }).map((hint) => hint.key)).toEqual(['/', '@', '$']);
    });

    test('keeps commands alone when nothing else opens a picker', () => {
        expect(placeholderHints(t, { mentionable: false, referable: false, hasSkills: false }).map((hint) => hint.key)).toEqual(['/']);
    });
});
