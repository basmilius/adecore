import { expect, test } from 'bun:test';
import type { ModelInfo } from '@adecore/agent-contracts';
import type { ClaudeEffortCapSource } from '../backends/limits-probe.ts';
import { capEffortChoices } from './claude-effort-cap.ts';

const FIVE = ['low', 'medium', 'high', 'xhigh', 'max', 'ultrathink'];
const NAMES: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high', max: 'Max', ultrathink: 'Ultrathink' };

function model(slug: string, efforts: readonly string[] = FIVE): ModelInfo {
    return {
        slug,
        name: slug,
        legacy: false,
        isDefault: false,
        options: [
            {
                id: 'effort',
                label: 'Reasoning',
                type: 'select',
                defaultChoice: 'high',
                choices: efforts.map((id) => ({ id, label: NAMES[id] ?? id }))
            }
        ]
    };
}

function labels(models: readonly ModelInfo[], slug: string): string[] {
    const descriptor = models.find((entry) => entry.slug === slug)?.options.find((option) => option.id === 'effort');

    return descriptor?.type === 'select' ? descriptor.choices.map((choice) => choice.label) : [];
}

const resolveAlias = (alias: string): string | null => ({ opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5' })[alias] ?? null;
const MODELS = [model('claude-opus-5-5'), model('claude-sonnet-5-5')];

test.each<[string, ClaudeEffortCapSource[], string, string[]]>([
    [
        'a top-level cap',
        [{ maxEffortLevel: 'high' }],
        'claude-opus-5-5',
        ['Low', 'Medium', 'High', 'Extra high (capped to High)', 'Max (capped to High)', 'Ultrathink']
    ],
    [
        "a cap per model, which replaces its own layer's top-level cap",
        [{ maxEffortLevel: 'medium', models: { 'claude-sonnet-5-5': 'xhigh' } }],
        'claude-sonnet-5-5',
        ['Low', 'Medium', 'High', 'Extra high', 'Max (capped to Extra high)', 'Ultrathink']
    ],
    [
        'a cap per model under a family alias with [1m]',
        [{ models: { 'opus[1m]': 'medium' } }],
        'claude-opus-5-5',
        ['Low', 'Medium', 'High (capped to Medium)', 'Extra high (capped to Medium)', 'Max (capped to Medium)', 'Ultrathink']
    ],
    [
        'a cap per model under a dated id',
        [{ models: { 'claude-opus-5-5-20260101': 'xhigh' } }],
        'claude-opus-5-5',
        ['Low', 'Medium', 'High', 'Extra high', 'Max (capped to Extra high)', 'Ultrathink']
    ],
    ['max as no cap', [{ maxEffortLevel: 'max' }], 'claude-opus-5-5', ['Low', 'Medium', 'High', 'Extra high', 'Max', 'Ultrathink']],
    [
        'the lowest across layers, though a later one sets a higher cap',
        [{ maxEffortLevel: 'high', models: { 'claude-opus-5-5': 'max' } }, { maxEffortLevel: 'xhigh' }],
        'claude-opus-5-5',
        ['Low', 'Medium', 'High', 'Extra high', 'Max (capped to Extra high)', 'Ultrathink']
    ]
])('%s', (_name, sources, slug, expected) => {
    expect(labels(capEffortChoices(MODELS, sources, resolveAlias), slug)).toEqual(expected);
});

test('a model without the capped level names the highest level it has under the cap', () => {
    const models = capEffortChoices([model('claude-haiku-5-5', ['low', 'medium', 'high', 'max'])], [{ maxEffortLevel: 'xhigh' }], resolveAlias);

    expect(labels(models, 'claude-haiku-5-5')).toEqual(['Low', 'Medium', 'High', 'Max (capped to High)']);
});

test('a capped label keeps the id, so a stored pick stays valid', () => {
    const [opus] = capEffortChoices(MODELS, [{ maxEffortLevel: 'high' }], resolveAlias);
    const descriptor = opus?.options[0];

    expect(descriptor?.type === 'select' ? descriptor.choices.map((choice) => choice.id) : []).toEqual(FIVE);
});
