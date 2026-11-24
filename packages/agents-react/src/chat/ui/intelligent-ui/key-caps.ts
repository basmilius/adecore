import { shortcut, shortcutParts } from '@adecore/ui';

/* How an agent may write a key, by its lower case, as the word a shortcut is parsed from. */
const KEY_WORDS: Readonly<Record<string, string>> = {
    mod: 'Mod',
    ctrl: 'Ctrl',
    control: 'Ctrl',
    alt: 'Alt',
    option: 'Alt',
    opt: 'Alt',
    shift: 'Shift',
    meta: 'Meta',
    cmd: 'Meta',
    command: 'Meta',
    enter: 'Enter',
    return: 'Enter',
    escape: 'Escape',
    esc: 'Escape',
    backspace: 'Backspace',
    delete: 'Delete',
    del: 'Delete',
    tab: 'Tab',
    space: 'Space',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
    arrowleft: 'ArrowLeft',
    arrowright: 'ArrowRight',
    arrowup: 'ArrowUp',
    arrowdown: 'ArrowDown'
};

/*
 * The caps of a shortcut written as `mod+K`, the way this platform prints them. Keys a shortcut cannot
 * hold, such as two letters or a key it has no name for, stand as written, with only `mod` translated.
 */
export function uiKeyCaps(text: string, apple: boolean): string[] {
    const written = text.trim();
    // A trailing `++` is the plus key itself, which a plain split would read as two empty words.
    const words = (written.endsWith('++') ? [...written.slice(0, -2).split('+'), '+'] : written === '+' ? ['+'] : written.split('+'))
        .map((word) => word.trim())
        .filter((word) => word !== '')
        .map((word) => KEY_WORDS[word.toLowerCase()] ?? (/^f\d{1,2}$/i.test(word) ? word.toUpperCase() : word));

    try {
        return shortcutParts(shortcut(words.join('+')), apple);
    } catch {
        return words.map((word) => (word === 'Mod' ? (apple ? '⌘' : 'Ctrl') : word));
    }
}
