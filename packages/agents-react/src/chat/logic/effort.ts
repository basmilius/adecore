import type { ModelInfo, ModelOptionChoice, ModelSelection } from '@adecore/agent-contracts';

/* The option a catalog names the reasoning effort by; its choices run from the least to the most. */
export const EFFORT_OPTION = 'effort';

/* `up` is one choice more effort, `down` one less. */
export type EffortStep = 'up' | 'down';

export type EffortStepResult =
    | { kind: 'stepped'; selection: ModelSelection; choice: ModelOptionChoice }
    /* Already at the end of the model's choices that way, which `choice` names. */
    | { kind: 'edge'; choice: ModelOptionChoice }
    /* The model has no effort to step, or the catalog does not know the model. */
    | { kind: 'none' };

/* One step of effort within what the model offers. A value the model no longer offers counts as its default. */
export function stepEffort(model: ModelInfo | undefined, selection: ModelSelection, step: EffortStep): EffortStepResult {
    const option = model?.options.find((candidate) => candidate.id === EFFORT_OPTION);

    if (option === undefined || option.type !== 'select') {
        return { kind: 'none' };
    }

    const chosen = selection.options[EFFORT_OPTION];
    const index = option.choices.findIndex((choice) => choice.id === chosen);
    const from = index === -1 ? option.choices.findIndex((choice) => choice.id === option.defaultChoice) : index;
    const current = Math.max(0, from);
    const next = current + (step === 'up' ? 1 : -1);
    const choice = option.choices[next];

    if (choice === undefined) {
        return { kind: 'edge', choice: option.choices[current]! };
    }

    return { kind: 'stepped', selection: { ...selection, options: { ...selection.options, [EFFORT_OPTION]: choice.id } }, choice };
}
