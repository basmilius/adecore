import type { ModelInfo, ModelSelection } from '@adecore/agent-contracts';
import { modelName, shortModelName } from '../../agents/model-name';
import { EFFORT_OPTION } from './effort';

/* Whether a turn ran on another model or effort than the one before it; other options do not count. */
export function switchesSelection(from: ModelSelection, to: ModelSelection): boolean {
    return from.model !== to.model || from.options[EFFORT_OPTION] !== to.options[EFFORT_OPTION];
}

/* The effort a selection runs on, in the catalog's words; null for a model without one or one the catalog does not know. */
function effortLabel(selection: ModelSelection, models: readonly ModelInfo[] | undefined): string | null {
    const option = models?.find((entry) => entry.slug === selection.model)?.options.find((candidate) => candidate.id === EFFORT_OPTION);

    if (option === undefined || option.type !== 'select') {
        return null;
    }

    const chosen = selection.options[EFFORT_OPTION];
    const choice = option.choices.find((candidate) => candidate.id === chosen) ?? option.choices.find((candidate) => candidate.id === option.defaultChoice);

    return choice?.label ?? null;
}

/*
 * Both sides of the line between two turns. A side names only what changed: the effort under the same model,
 * the models when the effort stayed, and both otherwise. Null when the two read the same.
 */
export function selectionSwitchText(from: ModelSelection, to: ModelSelection, models: readonly ModelInfo[] | undefined): { from: string; to: string } | null {
    const fromEffort = effortLabel(from, models);
    const toEffort = effortLabel(to, models);

    if (from.model === to.model) {
        return fromEffort === null || toEffort === null || fromEffort === toEffort ? null : { from: fromEffort, to: toEffort };
    }

    const fromName = shortModelName(modelName(from.model, models), models);
    const toName = shortModelName(modelName(to.model, models), models);

    if (fromEffort === toEffort) {
        return { from: fromName, to: toName };
    }

    return {
        from: fromEffort === null ? fromName : `${fromName} ${fromEffort}`,
        to: toEffort === null ? toName : `${toName} ${toEffort}`
    };
}
