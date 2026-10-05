import { chordOf, KEYMAP_IDS, parseChord, type Keymap } from '@adecore/editor/keymap';
import type { KeyChord } from '@adecore/editor';
import { matchesShortcut } from '@adecore/ui';

export interface LanguageShortcut extends KeyChord {
    readonly apple: boolean;
}

export function shortcutsOf(keymap: Keymap, apple: boolean) {
    const shortcuts = Object.fromEntries(
        KEYMAP_IDS.map((id) => {
            const text = chordOf(id, apple, keymap);
            return [id, text === null ? null : { ...parseChord(text), apple }];
        })
    ) as Record<keyof Keymap, LanguageShortcut | null>;
    return { ...shortcuts, rename: shortcuts.renameSymbol };
}

export function isShortcut(target: LanguageShortcut | null, event: KeyboardEvent): boolean {
    return target !== null && matchesShortcut(target, event, target.apple);
}
