import { describe, expect, test } from 'bun:test';
import { formatShortcut, matchesShortcut, shortcut, shortcutFromEvent, shortcutParts, shortcutText, type KeyLike } from './shortcut.ts';

const event = (patch: Partial<KeyLike>): KeyLike => ({ metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, key: '', code: '', ...patch });

describe('shortcut', () => {
    test('reads every modifier word', () => {
        expect(shortcut('Mod+Ctrl+Meta+Alt+Shift+K')).toEqual({ mod: true, ctrl: true, meta: true, alt: true, shift: true, key: 'K' });
        expect(shortcut('k')).toEqual({ mod: false, ctrl: false, meta: false, alt: false, shift: false, key: 'K' });
    });

    test('reads punctuation, the plus key and named keys', () => {
        expect(shortcut('Mod+,').key).toBe(',');
        expect(shortcut('Mod+\\').key).toBe('\\');
        expect(shortcut('Mod+Shift+[').key).toBe('[');
        expect(shortcut('Mod++').key).toBe('+');
        expect(shortcut('+').key).toBe('+');
        expect(shortcut('-').key).toBe('-');
        expect(shortcut('Ctrl+Shift+Escape').key).toBe('Escape');
        expect(shortcut('Mod+Alt+ArrowLeft').key).toBe('ArrowLeft');
        expect(shortcut('F2').key).toBe('F2');
    });

    test('modifiers alone are a shortcut for a pointer gesture', () => {
        expect(shortcut('Mod')).toEqual({ mod: true, ctrl: false, meta: false, alt: false, shift: false, key: '' });
    });

    test('throws on a word it does not know and on two keys', () => {
        expect(() => shortcut('Cmd+K')).toThrow();
        expect(() => shortcut('Mod+Return')).toThrow();
        expect(() => shortcut('Mod+K+L')).toThrow();
    });
});

describe('matchesShortcut', () => {
    const palette = shortcut('Mod+K');

    test('Mod is Cmd on macOS and Ctrl elsewhere, never the other one', () => {
        expect(matchesShortcut(palette, event({ metaKey: true, key: 'k', code: 'KeyK' }), true)).toBe(true);
        expect(matchesShortcut(palette, event({ ctrlKey: true, key: 'k', code: 'KeyK' }), false)).toBe(true);
        expect(matchesShortcut(palette, event({ ctrlKey: true, key: 'k', code: 'KeyK' }), true)).toBe(false);
        expect(matchesShortcut(palette, event({ metaKey: true, key: 'k', code: 'KeyK' }), false)).toBe(false);
    });

    test('an extra modifier is another shortcut', () => {
        expect(matchesShortcut(palette, event({ metaKey: true, shiftKey: true, key: 'K', code: 'KeyK' }), true)).toBe(false);
        expect(matchesShortcut(palette, event({ metaKey: true, ctrlKey: true, key: 'k', code: 'KeyK' }), true)).toBe(false);
    });

    test('letters match on the physical key, whatever Shift or Option made of the character', () => {
        expect(matchesShortcut(shortcut('Mod+Shift+F'), event({ metaKey: true, shiftKey: true, key: 'F', code: 'KeyF' }), true)).toBe(true);
        expect(matchesShortcut(shortcut('Alt+B'), event({ altKey: true, key: 'Dead', code: 'KeyB' }), true)).toBe(true);
    });

    test('digits match on the physical key, so Shift+1 still is while the character is !', () => {
        expect(matchesShortcut(shortcut('Mod+1'), event({ ctrlKey: true, key: '1', code: 'Digit1' }), false)).toBe(true);
        expect(matchesShortcut(shortcut('Shift+1'), event({ shiftKey: true, key: '!', code: 'Digit1' }), true)).toBe(true);
    });

    test('punctuation matches on the physical key and named keys on the key', () => {
        expect(matchesShortcut(shortcut('Mod+Shift+]'), event({ metaKey: true, shiftKey: true, key: '}', code: 'BracketRight' }), true)).toBe(true);
        expect(matchesShortcut(shortcut('Mod+Enter'), event({ ctrlKey: true, key: 'Enter', code: 'NumpadEnter' }), false)).toBe(true);
    });

    test('modifiers alone never match a key', () => {
        expect(matchesShortcut(shortcut('Mod'), event({ metaKey: true, key: 'Meta', code: 'MetaLeft' }), true)).toBe(false);
    });
});

describe('formatShortcut', () => {
    test('macOS prints the symbols in its own order, elsewhere the words joined with a plus', () => {
        expect(formatShortcut(shortcut('Mod+Alt+Shift+K'), true)).toBe('⌥⇧⌘K');
        expect(formatShortcut(shortcut('Mod+Alt+Shift+K'), false)).toBe('Ctrl+Alt+Shift+K');
        expect(formatShortcut(shortcut('Ctrl+Shift+Escape'), true)).toBe('⌃⇧Esc');
        expect(formatShortcut(shortcut('Ctrl+Shift+Escape'), false)).toBe('Ctrl+Shift+Esc');
        expect(shortcutParts(shortcut('Mod+Alt+Shift+K'), true)).toEqual(['⌥', '⇧', '⌘', 'K']);
        expect(shortcutParts(shortcut('Mod'), false)).toEqual(['Ctrl']);
    });

    test('every named key on both platforms', () => {
        const names: Array<[string, string, string]> = [
            ['Enter', '↩', 'Enter'],
            ['Backspace', '⌫', 'Backspace'],
            ['Delete', '⌦', 'Delete'],
            ['Escape', 'Esc', 'Esc'],
            ['Tab', '⇥', 'Tab'],
            ['Space', 'Space', 'Space'],
            ['ArrowLeft', '←', '←'],
            ['ArrowRight', '→', '→'],
            ['ArrowUp', '↑', '↑'],
            ['ArrowDown', '↓', '↓']
        ];

        for (const [name, apple, other] of names) {
            expect(formatShortcut(shortcut(name), true)).toBe(apple);
            expect(formatShortcut(shortcut(name), false)).toBe(other);
        }
    });
});

describe('shortcutFromEvent', () => {
    test('reads a letter by the physical key, whatever Shift or Option made of the character', () => {
        expect(shortcutFromEvent(event({ metaKey: true, shiftKey: true, key: 'K', code: 'KeyK' }), true)).toEqual(shortcut('Mod+Shift+K'));
        expect(shortcutFromEvent(event({ altKey: true, key: 'Dead', code: 'KeyB' }), true)).toEqual(shortcut('Alt+B'));
    });

    test('reads a digit by the physical key', () => {
        expect(shortcutFromEvent(event({ ctrlKey: true, shiftKey: true, key: '!', code: 'Digit1' }), false)).toEqual(shortcut('Mod+Shift+1'));
    });

    test('reads punctuation by the physical key', () => {
        expect(shortcutFromEvent(event({ metaKey: true, key: ',', code: 'Comma' }), true)).toEqual(shortcut('Mod+,'));
        expect(shortcutFromEvent(event({ metaKey: true, shiftKey: true, key: '{', code: 'BracketLeft' }), true)).toEqual(shortcut('Mod+Shift+['));
    });

    test('reads the characters that sit on a different key per layout by the character', () => {
        expect(shortcutFromEvent(event({ metaKey: true, key: '-', code: 'Minus' }), true)).toEqual(shortcut('Mod+-'));
        expect(shortcutFromEvent(event({ metaKey: true, shiftKey: true, key: '+', code: 'Equal' }), true)).toEqual(shortcut('Mod+Shift++'));
        expect(shortcutFromEvent(event({ metaKey: true, key: '=', code: 'Equal' }), true)).toEqual(shortcut('Mod+='));
    });

    test('reads named keys, Space and function keys', () => {
        expect(shortcutFromEvent(event({ ctrlKey: true, key: 'Enter', code: 'Enter' }), false)).toEqual(shortcut('Mod+Enter'));
        expect(shortcutFromEvent(event({ altKey: true, key: 'ArrowUp', code: 'ArrowUp' }), true)).toEqual(shortcut('Alt+ArrowUp'));
        expect(shortcutFromEvent(event({ ctrlKey: true, key: ' ', code: 'Space' }), false)).toEqual(shortcut('Mod+Space'));
        expect(shortcutFromEvent(event({ key: 'Escape', code: 'Escape' }), true)).toEqual(shortcut('Escape'));
        expect(shortcutFromEvent(event({ key: 'F2', code: 'F2' }), true)).toEqual(shortcut('F2'));
        expect(shortcutFromEvent(event({ metaKey: true, key: 'F12', code: 'F12' }), true)).toEqual(shortcut('Mod+F12'));
    });

    test('keeps the physical Ctrl on macOS and the physical Meta elsewhere apart from Mod', () => {
        expect(shortcutFromEvent(event({ ctrlKey: true, key: 'k', code: 'KeyK' }), true)).toEqual(shortcut('Ctrl+K'));
        expect(shortcutFromEvent(event({ ctrlKey: true, metaKey: true, key: 'k', code: 'KeyK' }), true)).toEqual(shortcut('Mod+Ctrl+K'));
        expect(shortcutFromEvent(event({ metaKey: true, key: 'k', code: 'KeyK' }), false)).toEqual(shortcut('Meta+K'));
        expect(shortcutFromEvent(event({ ctrlKey: true, metaKey: true, key: 'k', code: 'KeyK' }), false)).toEqual(shortcut('Mod+Meta+K'));
    });

    test('is null for a modifier on its own', () => {
        for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock']) {
            expect(shortcutFromEvent(event({ key, code: `${key}Left`, shiftKey: key === 'Shift' }), true)).toBeNull();
        }
    });

    test('is null for a key shortcut() has no word for', () => {
        expect(shortcutFromEvent(event({ metaKey: true, key: '1', code: 'Numpad1' }), true)).toBeNull();
        expect(shortcutFromEvent(event({ metaKey: true, key: 'F13', code: 'F13' }), true)).toBeNull();
        expect(shortcutFromEvent(event({ metaKey: true, key: 'Home', code: 'Home' }), true)).toBeNull();
        expect(shortcutFromEvent(event({ metaKey: true, shiftKey: true, key: '_', code: 'Minus' }), true)).toBeNull();
        expect(shortcutFromEvent(event({ key: 'Unidentified', code: '' }), true)).toBeNull();
        expect(shortcutFromEvent(event({ key: 'Process', code: 'KeyA' }), true)).toBeNull();
    });

    test('does not read a bare key as more than it is, leaving the refusal to the caller', () => {
        expect(shortcutFromEvent(event({ key: 'k', code: 'KeyK' }), true)).toEqual(shortcut('K'));
        expect(shortcutFromEvent(event({ shiftKey: true, key: 'K', code: 'KeyK' }), true)).toEqual(shortcut('Shift+K'));
    });

    test('matches the event it was read from', () => {
        const presses: Array<[KeyLike, boolean]> = [
            [event({ metaKey: true, shiftKey: true, key: 'p', code: 'KeyP' }), true],
            [event({ ctrlKey: true, altKey: true, key: '/', code: 'Slash' }), false],
            [event({ ctrlKey: true, key: '+', shiftKey: true, code: 'Equal' }), true],
            [event({ altKey: true, key: 'ArrowLeft', code: 'ArrowLeft' }), true]
        ];

        for (const [press, apple] of presses) {
            expect(matchesShortcut(shortcutFromEvent(press, apple)!, press, apple)).toBe(true);
        }
    });
});

describe('shortcutText', () => {
    test('writes the modifiers in a fixed order, then the key', () => {
        expect(shortcutText({ mod: true, ctrl: true, meta: true, alt: true, shift: true, key: 'K' })).toBe('Mod+Ctrl+Meta+Alt+Shift+K');
        expect(shortcutText(shortcut('Shift+Alt+Mod+K'))).toBe('Mod+Alt+Shift+K');
        expect(shortcutText(shortcut('F2'))).toBe('F2');
    });

    test('reads back through shortcut() as the same shortcut', () => {
        const texts = [
            'Mod+K',
            'Mod+Shift+K',
            'Ctrl+Alt+Delete',
            'Mod+,',
            'Mod+\\',
            'Mod+Shift+[',
            'Mod++',
            '+',
            '-',
            'Mod+=',
            'Alt+ArrowUp',
            'Mod+Space',
            'F2',
            'Mod+F12',
            'Mod',
            'Meta+Ctrl+1'
        ];

        for (const text of texts) {
            expect(shortcut(shortcutText(shortcut(text)))).toEqual(shortcut(text));
        }
    });

    test('round-trips what a key press read as', () => {
        const recorded = shortcutFromEvent(event({ metaKey: true, shiftKey: true, key: '+', code: 'Equal' }), true)!;
        expect(shortcutText(recorded)).toBe('Mod+Shift++');
        expect(shortcut(shortcutText(recorded))).toEqual(recorded);
    });
});
