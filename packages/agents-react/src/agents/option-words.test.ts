import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import i18next from 'i18next';
import type { ModelOptionDescriptor } from '@adecore/agent-contracts';
import { AGENTS_LOCALES } from '../locales';
import { choiceWord, localizedOption, optionWord } from './option-words';

const EFFORT: ModelOptionDescriptor = {
    id: 'effort',
    label: 'Reasoning',
    type: 'select',
    defaultChoice: 'high',
    choices: [
        { id: 'low', label: 'Low' },
        { id: 'high', label: 'High' },
        { id: 'ultrathink', label: 'Ultrathink' }
    ]
};

beforeAll(async () => {
    for (const [namespace, words] of Object.entries(await AGENTS_LOCALES.nl!())) {
        i18next.addResourceBundle('nl', namespace, words, true, true);
    }

    await i18next.changeLanguage('nl');
});

afterAll(async () => {
    await i18next.changeLanguage('en');
});

describe('the words of a model option', () => {
    test("reads the catalog's words in the person's language", () => {
        const option = localizedOption(EFFORT);
        expect(option.label).toBe('Denkniveau');
        expect(option.type === 'select' && option.choices.map((choice) => choice.label)).toEqual(['Laag', 'Hoog', 'Ultrathink']);
        expect(optionWord({ id: 'fastMode', label: 'Fast mode', type: 'boolean', defaultValue: false })).toBe('Snelle modus');
    });

    test('keeps a word an agent wrote itself, also under an id the catalog knows', () => {
        expect(choiceWord('effort', { id: 'high', label: 'Deep' })).toBe('Deep');
        expect(optionWord({ ...EFFORT, label: 'Thought level' })).toBe('Thought level');
        expect(optionWord({ ...EFFORT, id: 'verbosity', label: 'Verbosity' })).toBe('Verbosity');
    });
});
