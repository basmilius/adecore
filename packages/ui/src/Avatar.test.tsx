import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from './Avatar.tsx';
import { initialsOf } from './initials.ts';

describe('initials', () => {
    test('take the first two words that start with a capital', () => {
        expect(initialsOf('Sanne de Vries')).toBe('SV');
        expect(initialsOf('Jan Willem van den Berg')).toBe('JW');
    });

    test('fall back to the first letter, in capitals', () => {
        expect(initialsOf('mama')).toBe('M');
        expect(initialsOf('  jan dekker ')).toBe('J');
        expect(initialsOf('')).toBe('');
    });

    test('keep a letter outside the basic plane whole', () => {
        expect(initialsOf('𝐀da Lovelace')).toBe('𝐀L');
        expect(initialsOf('Émile Zola')).toBe('ÉZ');
    });
});

describe('an avatar', () => {
    test('reads as the name', () => {
        const markup = renderToStaticMarkup(<Avatar name="Sanne de Vries" />);
        expect(markup).toContain('role="img"');
        expect(markup).toContain('aria-label="Sanne de Vries"');
        expect(markup).toContain('>SV</span>');
    });

    test('keeps the initials in view until the picture has loaded', () => {
        const markup = renderToStaticMarkup(<Avatar name="Sanne de Vries" src="/sanne.png" />);
        expect(markup).toContain('src="/sanne.png"');
        expect(markup).toContain('opacity-0');
        expect(markup).not.toContain('invisible');
    });
});
