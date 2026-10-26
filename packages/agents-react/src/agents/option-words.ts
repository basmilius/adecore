import i18next from 'i18next';
import type { ModelOptionDescriptor } from '@adecore/agent-contracts';

/*
 * The model catalogs write a model's knobs in English. Those words read in the person's language; a word
 * that differs from the catalog's is an agent's own and stays as the agent wrote it.
 */
function catalogWord(key: string, written: string): string {
    return i18next.t(key, { lng: 'en', defaultValue: '' }) === written ? i18next.t(key) : written;
}

export function optionWord(option: ModelOptionDescriptor): string {
    return catalogWord(`agent-chat:modelOptions.${option.id}.label`, option.label);
}

export function choiceWord(optionId: string, choice: { id: string; label: string }): string {
    return catalogWord(`agent-chat:modelOptions.${optionId}.choices.${choice.id}`, choice.label);
}

/* The option with the words a person reads, for a surface that draws its labels and choices. */
export function localizedOption(option: ModelOptionDescriptor): ModelOptionDescriptor {
    const label = optionWord(option);

    if (option.type !== 'select') {
        return { ...option, label };
    }

    return { ...option, label, choices: option.choices.map((choice) => ({ ...choice, label: choiceWord(option.id, choice) })) };
}
