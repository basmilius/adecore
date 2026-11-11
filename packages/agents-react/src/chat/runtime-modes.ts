import { RuntimeModeSchema, type RuntimeMode } from '@adecore/agent-contracts';
import i18next from 'i18next';

/*
 * The runtime modes in the order they are offered: the schema's, which the host reads as the rank
 * from narrowest to widest. Their words are read when a view draws one, not when this module loads.
 */
export const RUNTIME_MODES: readonly RuntimeMode[] = RuntimeModeSchema.options;

/* Whether this version knows a mode a host reports; a newer host's mode is shown as set there and never sent back as another. */
export function isKnownRuntimeMode(mode: string): mode is RuntimeMode {
    return (RUNTIME_MODES as readonly string[]).includes(mode);
}

export function runtimeModeLabel(mode: string): string {
    return isKnownRuntimeMode(mode) ? i18next.t(`agent-chat:modes.${mode}.label`) : i18next.t('agent-chat:modes.unknown.label');
}

export function runtimeModeHint(mode: RuntimeMode): string {
    return i18next.t(`agent-chat:modes.${mode}.hint`);
}
