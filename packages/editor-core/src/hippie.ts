import { isBraced, isWordCharacter } from './lexical.ts';
import type { TextEdit } from './types.ts';

/* Texts of other documents longer than this are not read for words. */
const MAX_SOURCE_LENGTH = 2_000_000;

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const LETTER = /\p{L}/u;

export interface HippieOptions {
    language: string;
    /* The texts of the other open documents, in the order their words are offered. */
    wordSources?: () => readonly string[];
}

interface Word {
    text: string;
    start: number;
    end: number;
}

/* A word the cycle can offer. `side` tells which side of the caret a word of this document stands on. */
interface Variant extends Word {
    source: 'here' | 'other';
    side: 'before' | 'after';
}

/* What the last press left, so the next one goes on from it. */
export interface HippieCycle {
    /* What stood at the caret before the first press, which every press of the cycle completes. */
    prefix: string;
    /* The length of the text each caret holds from the last press, which the next press replaces. */
    length: number;
    /* The carets the last press left. */
    carets: readonly number[];
    proposal: Pick<Variant, 'text' | 'source' | 'side'>;
}

export interface HippiePlan {
    edits: TextEdit[];
    carets: number[];
    /* Null when the cycle is over and the next press starts again. */
    cycle: HippieCycle | null;
    /* Where the proposed word stands in this document after the edit, when it came from here. */
    source: { from: number; to: number } | null;
}

interface Position {
    source: 'here' | 'other';
    index: number;
}

function isWordPart(character: string, hyphenated: boolean): boolean {
    return isWordCharacter(character) || (hyphenated && (character === '-' || character === '*'));
}

/* The words of a text in order. A word has a letter or a digit in it. */
export function hippieWords(text: string, hyphenated: boolean): Word[] {
    const words: Word[] = [];
    let start = -1;

    for (let i = 0; i <= text.length; i++) {
        const inside = i < text.length && isWordPart(text[i]!, hyphenated);

        if (inside && start < 0) {
            start = i;
        } else if (!inside && start >= 0) {
            const word = text.slice(start, i);

            if (LETTER_OR_DIGIT.test(word)) {
                words.push({ text: word, start, end: i });
            }

            start = -1;
        }
    }

    return words;
}

/* Where the word before the caret starts, which is the caret itself when it is not in a word. */
export function hippiePrefixStart(text: string, caret: number, hyphenated: boolean): number {
    let start = caret;

    while (start > 0 && isWordPart(text[start - 1]!, hyphenated)) {
        start--;
    }

    return LETTER_OR_DIGIT.test(text.slice(start, caret)) ? start : caret;
}

/* A letter that starts a camel hump (an uppercase after a lowercase) or follows a `_`, a `-` or a digit. */
function isHump(word: string, index: number): boolean {
    const character = word[index]!;
    const before = word[index - 1]!;

    if (!LETTER.test(character)) {
        return false;
    }

    const startsHump = character !== character.toLowerCase() && before !== before.toUpperCase();

    return startsHump || /[\d_-]/.test(before);
}

function continues(word: string, prefix: string, wordIndex: number, prefixIndex: number): boolean {
    if (prefixIndex === prefix.length) {
        return true;
    }

    for (let i = wordIndex; i < word.length; i++) {
        // The character right after the last match continues it; any other has to start a hump.
        if (i > wordIndex && !isHump(word, i)) {
            continue;
        }

        if (word[i]!.toLowerCase() === prefix[prefixIndex]!.toLowerCase() && continues(word, prefix, i + 1, prefixIndex + 1)) {
            return true;
        }
    }

    return false;
}

/* Whether a word is longer than the prefix and starts with it: the first character as typed, the rest by letters of any case or camel humps. */
export function hippieMatches(word: string, prefix: string): boolean {
    if (word.length <= prefix.length) {
        return false;
    }

    return prefix === '' || (word[0] === prefix[0] && continues(word, prefix, 1, 1));
}

/* The words of this document that complete the prefix: those before the primary caret ascending, then those after it. */
function variantsHere(text: string, carets: readonly number[], primary: number, prefix: string, hyphenated: boolean): Variant[] {
    const before = new Map<string, Variant>();
    const after = new Map<string, Variant>();

    const words = hippieWords(text, hyphenated).filter(
        (word) => !carets.some((caret) => word.start <= caret && caret <= word.end) && hippieMatches(word.text, prefix)
    );

    // The nearest occurrence of a repeated word stands: walk back from the caret before it, forward from it after.
    for (const word of words.filter((entry) => entry.end <= primary).reverse()) {
        if (!before.has(word.text)) {
            before.set(word.text, { ...word, source: 'here', side: 'before' });
        }
    }

    for (const word of words) {
        if (word.end > primary && !after.has(word.text)) {
            after.set(word.text, { ...word, source: 'here', side: 'after' });
        }
    }

    return [...before.values()].reverse().concat([...after.values()]);
}

function variantsOther(sources: readonly string[], prefix: string, hyphenated: boolean): Variant[] {
    const seen = new Map<string, Variant>();

    for (const source of sources) {
        if (source.length > MAX_SOURCE_LENGTH) {
            continue;
        }

        for (const word of hippieWords(source, hyphenated)) {
            if (!seen.has(word.text) && hippieMatches(word.text, prefix)) {
                seen.set(word.text, { ...word, source: 'other', side: 'after' });
            }
        }
    }

    return [...seen.values()];
}

/* The first proposal going up is the nearest word above the caret, going down the nearest below it. */
function homeOf(here: readonly Variant[], direction: 1 | -1): number {
    const firstAfter = here.findIndex((variant) => variant.side === 'after');

    if (direction === 1) {
        return Math.max((firstAfter < 0 ? here.length : firstAfter) - 1, 0);
    }

    return firstAfter < 0 ? 0 : firstAfter;
}

/* Where a source runs out the cycle goes to the other documents, and from there back home. */
function enter(here: readonly Variant[], other: readonly Variant[], direction: 1 | -1, from: 'here' | 'other'): Position | null {
    const otherStart: Position = { source: 'other', index: direction === 1 ? other.length - 1 : 0 };

    if (from === 'here' && other.length > 0) {
        return otherStart;
    }

    if (here.length > 0) {
        return { source: 'here', index: homeOf(here, direction) };
    }

    return other.length > 0 ? otherStart : null;
}

function step(here: readonly Variant[], other: readonly Variant[], current: Position | null, direction: 1 | -1): Position | null {
    if (current === null) {
        return enter(here, other, direction, 'other');
    }

    const list = current.source === 'here' ? here : other;
    const index = current.index + (direction === 1 ? -1 : 1);

    return index >= 0 && index < list.length ? { source: current.source, index } : enter(here, other, direction, current.source);
}

/* Where a word stands once the edits are made, or null when an edit reaches into it. */
function sourceAfter(word: Word, edits: readonly TextEdit[]): { from: number; to: number } | null {
    let delta = 0;

    for (const edit of edits) {
        if (edit.to <= word.start) {
            delta += edit.text.length - (edit.to - edit.from);
        } else if (edit.from < word.end) {
            return null;
        }
    }

    return { from: word.start + delta, to: word.end + delta };
}

/*
 * The next proposal of Hippie completion: the word before each caret is replaced by a longer word that starts the
 * same, the nearest in this document first, and the following presses go through the others and then through the
 * other open documents. `cycle` is what the last press left; pass it only while nothing has moved since.
 * `carets` is ascending and `primary` is one of them.
 */
export function planHippie(
    text: string,
    carets: readonly number[],
    primary: number,
    cycle: HippieCycle | null,
    direction: 1 | -1,
    options: HippieOptions
): HippiePlan | null {
    const hyphenated = !isBraced(options.language);
    const prefix = cycle?.prefix ?? text.slice(hippiePrefixStart(text, primary, hyphenated), primary);
    const here = variantsHere(text, carets, primary, prefix, hyphenated);
    const other = variantsOther(options.wordSources?.() ?? [], prefix, hyphenated);
    let current: Position | null = null;

    if (cycle !== null) {
        const index = (cycle.proposal.source === 'here' ? here : other).findIndex(
            (variant) => variant.text === cycle.proposal.text && variant.side === cycle.proposal.side
        );

        current = index < 0 ? null : { source: cycle.proposal.source, index };
    }

    const next = step(here, other, current, direction);
    const variant = next === null ? null : (next.source === 'here' ? here : other)[next.index]!;

    if (variant === null && cycle === null) {
        return null;
    }

    // With nothing left to offer, a cycle that is under way gives the prefix back.
    const proposal = variant?.text ?? prefix;
    const length = cycle?.length ?? prefix.length;
    const edits: TextEdit[] = [];
    const landed: number[] = [];
    let end = 0;
    let delta = 0;

    for (const caret of carets) {
        const from = Math.max(caret - length, end);

        edits.push({ from, to: caret, text: proposal });
        landed.push(from + delta + proposal.length);
        delta += proposal.length - (caret - from);
        end = caret;
    }

    return {
        edits,
        carets: landed,
        cycle:
            variant === null
                ? null
                : { prefix, length: proposal.length, carets: landed, proposal: { text: variant.text, source: variant.source, side: variant.side } },
        source: variant?.source === 'here' ? sourceAfter(variant, edits) : null
    };
}
