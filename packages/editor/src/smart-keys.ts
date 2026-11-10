import type { EditorSmartKeys } from './types.ts';

export const DEFAULT_SMART_KEYS: EditorSmartKeys = {
    autoPairBrackets: true,
    autoPairQuotes: true,
    surroundSelection: true,
    tabOutOfClosers: true,
    smartIndentOnEnter: true,
    indentOnPaste: true,
    smartSemicolon: true,
    smartArrow: true,
    templateLiterals: true,
    camelHumps: false
};

export function resolveSmartKeys(keys: Partial<EditorSmartKeys> | undefined): EditorSmartKeys {
    return { ...DEFAULT_SMART_KEYS, ...keys };
}
