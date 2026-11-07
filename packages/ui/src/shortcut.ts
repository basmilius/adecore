/*
 * `mod` is Cmd on macOS and Ctrl everywhere else; `ctrl` and `meta` name the physical key, for the few
 * shortcuts that differ per platform on purpose.
 */
export interface Shortcut {
    mod: boolean;
    ctrl: boolean;
    meta: boolean;
    alt: boolean;
    shift: boolean;

    /* An uppercase letter, a digit, a punctuation mark or a named key (`Enter`, `ArrowLeft`, `F2`).
       Empty for modifiers held during a pointer gesture (`Mod` then "drag"), which never match a key. */
    key: string;
}

export type KeyLike = Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'key' | 'code'>;

/* Matched on the physical key: Shift turns `[` into `{` and Option turns most keys into a dead key. */
const PUNCTUATION_CODES: Record<string, string> = {
    ',': 'Comma',
    '.': 'Period',
    '/': 'Slash',
    ';': 'Semicolon',
    "'": 'Quote',
    '`': 'Backquote',
    '\\': 'Backslash',
    '[': 'BracketLeft',
    ']': 'BracketRight'
};

/* Matched on the character, because `+` sits on a different key per layout. */
const CHARACTER_KEYS = new Set(['+', '-', '=']);

const NAMED_KEYS = new Set(['Enter', 'Escape', 'Backspace', 'Delete', 'Tab', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;

const MODIFIER_FIELDS: Readonly<Record<string, 'mod' | 'ctrl' | 'meta' | 'alt' | 'shift'>> = {
    Mod: 'mod',
    Ctrl: 'ctrl',
    Meta: 'meta',
    Alt: 'alt',
    Shift: 'shift'
};

const isKey = (word: string): boolean =>
    /^[A-Za-z0-9]$/.test(word) || word in PUNCTUATION_CODES || CHARACTER_KEYS.has(word) || NAMED_KEYS.has(word) || FUNCTION_KEY.test(word);

/**
 * Parses `Mod+Shift+K`. Throws on a word it does not know or on two keys, so a typo in a table fails
 * the moment the module loads instead of leaving a shortcut that never fires.
 */
export const shortcut = (text: string): Shortcut => {
    // A trailing `++` is the plus key itself, which a plain split would read as two empty words.
    const words = text === '+' ? ['+'] : text.endsWith('++') ? [...text.slice(0, -2).split('+'), '+'] : text.split('+');
    const result: Shortcut = { mod: false, ctrl: false, meta: false, alt: false, shift: false, key: '' };

    for (const word of words) {
        if (Object.hasOwn(MODIFIER_FIELDS, word)) {
            result[MODIFIER_FIELDS[word]!] = true;

            continue;
        }

        if (!isKey(word)) {
            throw new Error(`Unknown key "${word}" in shortcut "${text}"`);
        }

        if (result.key !== '') {
            throw new Error(`Shortcut "${text}" names two keys`);
        }

        result.key = word.length === 1 ? word.toUpperCase() : word;
    }

    return result;
};

// Letters and digits match on `code`: with Shift held `key` says `!` for 1, and Option's dead keys change it on macOS.
const matchesKey = (key: string, event: KeyLike): boolean => {
    if (/^[A-Z]$/.test(key)) {
        return event.code === `Key${key}`;
    }

    if (/^[0-9]$/.test(key)) {
        return event.code === `Digit${key}`;
    }

    const code = PUNCTUATION_CODES[key];

    if (code) {
        return event.code === code;
    }

    if (key === 'Space') {
        return event.code === 'Space';
    }

    return event.key === key;
};

/* Strict: every modifier the shortcut does not name has to be up, so Ctrl+K on macOS is not Cmd+K. */
export const matchesShortcut = (target: Shortcut, event: KeyLike, apple: boolean): boolean => {
    const meta = target.meta || (target.mod && apple);
    const ctrl = target.ctrl || (target.mod && !apple);

    if (target.key === '' || event.metaKey !== meta || event.ctrlKey !== ctrl || event.altKey !== target.alt || event.shiftKey !== target.shift) {
        return false;
    }

    return matchesKey(target.key, event);
};

/* The punctuation keys by their code, the other way round from `PUNCTUATION_CODES`. */
const PUNCTUATION_BY_CODE: Readonly<Record<string, string>> = /* @__PURE__ */ Object.fromEntries(
    Object.entries(PUNCTUATION_CODES).map(([key, code]) => [code, key])
);

/* The key of an event in the words `shortcut()` writes, or null for a key it has no word for. */
const keyOfEvent = (event: KeyLike): string | null => {
    const { code, key } = event;

    // An input method's own key press, with the code of the key it was typed on.
    if (key === 'Process') {
        return null;
    }

    if (/^Key[A-Z]$/.test(code)) {
        return code.slice(3);
    }

    if (/^Digit[0-9]$/.test(code)) {
        return code.slice(5);
    }

    if (Object.hasOwn(PUNCTUATION_BY_CODE, code)) {
        return PUNCTUATION_BY_CODE[code]!;
    }

    if (code === 'Space') {
        return 'Space';
    }

    return CHARACTER_KEYS.has(key) || NAMED_KEYS.has(key) || FUNCTION_KEY.test(key) ? key : null;
};

/**
 * Reads a key press as a shortcut, for a screen that records one. The platform's modifier becomes `mod`, so
 * the result prints and matches on every platform; Ctrl on macOS and Meta elsewhere stay `ctrl` and `meta`.
 * Null for a modifier pressed alone and for a key `shortcut()` cannot write, such as a numpad digit, or `_`
 * where Shift and `-` type it.
 */
export const shortcutFromEvent = (event: KeyLike, apple: boolean): Shortcut | null => {
    const key = keyOfEvent(event);

    if (key === null) {
        return null;
    }

    const result: Shortcut = {
        mod: apple ? event.metaKey : event.ctrlKey,
        ctrl: apple && event.ctrlKey,
        meta: !apple && event.metaKey,
        alt: event.altKey,
        shift: event.shiftKey,
        key
    };

    // What the result would not match is a press `shortcut()` has no word for.
    return matchesShortcut(result, event, apple) ? result : null;
};

/* Writes a shortcut the way `shortcut()` reads it, such as `Mod+Shift+K`, to keep it as text. */
export const shortcutText = (target: Shortcut): string => {
    const words: string[] = [];

    for (const [word, field] of Object.entries(MODIFIER_FIELDS)) {
        if (target[field]) {
            words.push(word);
        }
    }

    if (target.key !== '') {
        words.push(target.key);
    }

    return words.join('+');
};

const KEY_LABELS: Record<string, { apple: string; other: string }> = {
    Enter: { apple: '↩', other: 'Enter' },
    Backspace: { apple: '⌫', other: 'Backspace' },
    Delete: { apple: '⌦', other: 'Delete' },
    Escape: { apple: 'Esc', other: 'Esc' },
    Tab: { apple: '⇥', other: 'Tab' },
    Space: { apple: 'Space', other: 'Space' },
    ArrowLeft: { apple: '←', other: '←' },
    ArrowRight: { apple: '→', other: '→' },
    ArrowUp: { apple: '↑', other: '↑' },
    ArrowDown: { apple: '↓', other: '↓' }
};

/* In the order the platform prints them. */
export const shortcutParts = (target: Shortcut, apple: boolean): string[] => {
    const parts: string[] = [];

    if (apple) {
        if (target.ctrl) {
            parts.push('⌃');
        }

        if (target.alt) {
            parts.push('⌥');
        }

        if (target.shift) {
            parts.push('⇧');
        }

        if (target.meta || target.mod) {
            parts.push('⌘');
        }
    } else {
        if (target.ctrl || target.mod) {
            parts.push('Ctrl');
        }

        if (target.alt) {
            parts.push('Alt');
        }

        if (target.shift) {
            parts.push('Shift');
        }

        if (target.meta) {
            parts.push('Meta');
        }
    }

    if (target.key !== '') {
        const label = KEY_LABELS[target.key];
        parts.push(label ? label[apple ? 'apple' : 'other'] : target.key);
    }

    return parts;
};

/* `⌥⇧⌘K` on macOS, `Ctrl+Alt+Shift+K` elsewhere. */
export const formatShortcut = (target: Shortcut, apple: boolean): string => shortcutParts(target, apple).join(apple ? '' : '+');

/* The browser's own editing shortcuts, which the app only ever prints in a menu. */
export const EDIT_SHORTCUTS = {
    copy: /* @__PURE__ */ shortcut('Mod+C'),
    cut: /* @__PURE__ */ shortcut('Mod+X'),
    paste: /* @__PURE__ */ shortcut('Mod+V'),
    selectAll: /* @__PURE__ */ shortcut('Mod+A')
} as const;

/* Keys that are not a shortcut of their own but are printed as one in a hint. */
export const KEY_SHORTCUTS = {
    enter: /* @__PURE__ */ shortcut('Enter'),
    modEnter: /* @__PURE__ */ shortcut('Mod+Enter'),
    backspace: /* @__PURE__ */ shortcut('Backspace'),
    escape: /* @__PURE__ */ shortcut('Escape'),
    shift: /* @__PURE__ */ shortcut('Shift'),
    rename: /* @__PURE__ */ shortcut('F2')
} as const;

export const isModHeld = (event: Pick<KeyLike, 'metaKey' | 'ctrlKey'>, apple: boolean): boolean => (apple ? event.metaKey : event.ctrlKey);
