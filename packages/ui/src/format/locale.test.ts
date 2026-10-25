import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { fakeFormatSource } from '../testing/fake-source.ts';
import { labelCollator, nameCollator, setFormatSource, type FormatSource } from './locale.ts';

const source = fakeFormatSource();
let previous: FormatSource;

beforeAll(() => {
    previous = setFormatSource(source);
});

afterAll(() => {
    setFormatSource(previous);
});

const inLanguage = (language: string): void => {
    source.set({ language });
};

afterEach(() => {
    inLanguage('en');
});

describe('the order labels are read in', () => {
    test('follows the language, which is what wrote the words', () => {
        source.set({ region: 'nl-NL' });
        inLanguage('en');
        expect(labelCollator().resolvedOptions().locale).toBe('en');
        expect(['z', 'ä'].sort(labelCollator().compare)).toEqual(['ä', 'z']);
        inLanguage('nl');
        expect(labelCollator().resolvedOptions().locale).toBe('nl');
        inLanguage('sv');
        expect(['z', 'ä'].sort(labelCollator().compare)).toEqual(['z', 'ä']);
    });

    test('ignores case, so a lowercase label never sinks to the bottom', () => {
        inLanguage('en');
        expect(labelCollator().compare('canvas', 'Canvas')).toBe(0);
        expect(labelCollator().compare('Canvas', 'terminal')).toBeLessThan(0);
    });
});

describe('the order of proper names', () => {
    test('reuses a spec and keeps native ordering when the interface language changes', () => {
        const options: Intl.CollatorOptions = { sensitivity: 'base', numeric: true };
        const collator = nameCollator(options);
        expect(collator.compare('Model 2', 'model 2')).toBe(0);
        expect(collator.compare('Model 2', 'Model 10')).toBeLessThan(0);
        inLanguage('sv');
        expect(nameCollator(options)).toBe(collator);
        expect(collator.resolvedOptions().locale).toBe(new Intl.Collator().resolvedOptions().locale);
        const lexical = nameCollator({ sensitivity: 'base', numeric: false });
        expect(lexical.compare('Vendor 10', 'Vendor 2')).toBeLessThan(0);
    });
});
