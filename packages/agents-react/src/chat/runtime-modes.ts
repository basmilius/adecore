import i18next from 'i18next';
import { RuntimeModeSchema, type RuntimeMode } from '@adecore/agent-contracts';

/*
 * The runtime modes in the order they are offered: the schema's, which the host reads as the rank
 * from narrowest to widest. Their words are read when a surface draws one, not when this module loads.
 */
export const RUNTIME_MODES: readonly RuntimeMode[] = RuntimeModeSchema.options;

export function runtimeModeLabel(mode: RuntimeMode): string {
    return i18next.t(`agent-chat:modes.${mode}.label`);
}

export function runtimeModeHint(mode: RuntimeMode): string {
    return i18next.t(`agent-chat:modes.${mode}.hint`);
}
