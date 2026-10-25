/*
 * What a file dragged out of an app's own list of files carries: the paths, space separated, relative
 * to the folder. The composer takes it next to the image files it already accepts.
 */
export const MENTION_DRAG_TYPE = 'application/x-adecore-mention';
export const LEGACY_MENTION_DRAG_TYPE = 'application/x-ruimte-mention';
export const MENTION_DRAG_TYPES = [MENTION_DRAG_TYPE, LEGACY_MENTION_DRAG_TYPE] as const;

export function carriesMentions(types: readonly string[]): boolean {
    return MENTION_DRAG_TYPES.some((type) => types.includes(type));
}

export function droppedMentions(data: Pick<DataTransfer, 'getData'>): string[] {
    const text = data.getData(MENTION_DRAG_TYPE) || data.getData(LEGACY_MENTION_DRAG_TYPE);
    return text.trim() === '' ? [] : text.trim().split(/\s+/);
}

export function writeMentionDrag(data: Pick<DataTransfer, 'setData'>, paths: readonly string[], legacy = true): void {
    const text = paths.join(' ');
    data.setData(MENTION_DRAG_TYPE, text);
    if (legacy) {
        data.setData(LEGACY_MENTION_DRAG_TYPE, text);
    }
}

/* Beside the plain text of a copy from a thread or a composer: the chips in it, so a paste makes them chips again. */
export const CHIPS_CLIPBOARD_TYPE = 'application/x-adecore-chips';

export interface ClipboardChips {
    text: string;
    mentions: string[];
    skills: string[];
    references: ReferenceToken[];
}

/* The chips among `segments`, without doubles, for the copy of `text`. */
export function clipboardChipsOf(text: string, segments: readonly ChipSegment[]): ClipboardChips {
    const chips: ClipboardChips = { text, mentions: [], skills: [], references: [] };
    for (const segment of segments) {
        if (segment.kind === 'mention' && !chips.mentions.includes(segment.path)) {
            chips.mentions.push(segment.path);
        } else if (segment.kind === 'skill' && !chips.skills.includes(segment.name)) {
            chips.skills.push(segment.name);
        } else if (segment.kind === 'reference' && !chips.references.some((token) => token.id === segment.id)) {
            chips.references.push({ id: segment.id, name: segment.name });
        }
    }
    return chips;
}

export function hasClipboardChips(chips: ClipboardChips): boolean {
    return chips.mentions.length > 0 || chips.skills.length > 0 || chips.references.length > 0;
}

export function writeClipboardChips(data: Pick<DataTransfer, 'setData'>, chips: ClipboardChips): void {
    data.setData('text/plain', chips.text);
    data.setData(CHIPS_CLIPBOARD_TYPE, JSON.stringify(chips));
}

const lines = (text: string): string => text.replace(/\r\n/g, '\n');

const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');

/* The chips of a paste, or null when it has none or its plain text is no longer the text they were copied with. */
export function readClipboardChips(data: Pick<DataTransfer, 'getData'>): ClipboardChips | null {
    const raw = data.getData(CHIPS_CLIPBOARD_TYPE);
    if (raw === '') {
        return null;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null) {
        return null;
    }
    const { text, mentions, skills, references } = parsed as Record<string, unknown>;
    const tokens = Array.isArray(references)
        ? references.filter(
              (token): token is ReferenceToken =>
                  typeof token === 'object' && token !== null && typeof token.id === 'string' && typeof token.name === 'string' && token.name !== ''
          )
        : [];
    if (typeof text !== 'string' || lines(text) !== lines(data.getData('text/plain')) || !isStrings(mentions) || !isStrings(skills)) {
        return null;
    }
    return { text: lines(text), mentions, skills, references: tokens.map(({ id, name }) => ({ id, name })) };
}

export interface MentionQuery {
    // Index of the sigil in the text.
    start: number;
    query: string;
}

/* A view, node or chat picked with `#`, under the name the text spells it by, which may hold spaces. */
export interface ReferenceToken {
    id: string;
    name: string;
}

export type ChipSegment =
    | { kind: 'text'; text: string }
    | { kind: 'mention'; path: string }
    | { kind: 'skill'; name: string }
    | { kind: 'reference'; id: string; name: string };

function isBoundary(char: string | undefined): boolean {
    return char === undefined || /\s/.test(char);
}

const TOKEN_END = /[.,;:!?)\]}"'”’]/;

// A path at the end of a sentence still counts, so "open @a.ts." is a mention of a.ts.
function isTokenEnd(char: string | undefined): boolean {
    return isBoundary(char) || TOKEN_END.test(char!);
}

// A path goes on after a dot or a colon (`a.ts`, `C:`), so only the rest ends a file query.
const PATH_GOES_ON = /[.:]$/;

/*
 * The `<sigil>word` the caret sits in, if any. The sigil has to open a word (start of text or after
 * whitespace) so an email address never opens the picker, and the word may not have been closed
 * with whitespace or the punctuation that ends a token (`#Admin?`) yet.
 */
function findQuery(text: string, caret: number, sigil: string): MentionQuery | null {
    const before = text.slice(0, caret);
    const at = before.lastIndexOf(sigil);
    if (at < 0 || !isBoundary(before[at - 1])) {
        return null;
    }
    const query = before.slice(at + 1);
    if (/\s/.test(query) || !isBoundary(text[caret])) {
        return null;
    }
    if (query !== '' && isTokenEnd(query.at(-1)) && !(sigil === '@' && PATH_GOES_ON.test(query))) {
        return null;
    }
    return { start: at, query };
}

/* The query, unless its sigil opens a token that is already a chip, which the picker has nothing to add to. */
export function queryOutsideChips(query: MentionQuery | null, chips: readonly ChipRange[]): MentionQuery | null {
    return query !== null && chips.some((chip) => chip.from === query.start) ? null : query;
}

export function findMentionQuery(text: string, caret: number): MentionQuery | null {
    return findQuery(text, caret, '@');
}

/* The `$word` the caret sits in. The name has to start with a letter, so `$20` and `$1e6` stay text. */
export function findSkillQuery(text: string, caret: number): MentionQuery | null {
    const found = findQuery(text, caret, '$');
    return found === null || (found.query !== '' && !/^[A-Za-z]/.test(found.query)) ? null : found;
}

/*
 * The `#word` the caret sits in. It opens only once a letter follows the sigil, so a `# ` heading,
 * `#123` and a bare `#` stay text. A name with a space is found by its first word.
 */
export function findReferenceQuery(text: string, caret: number): MentionQuery | null {
    const found = findQuery(text, caret, '#');
    return found === null || !/^\p{L}/u.test(found.query) ? null : found;
}

/* Replaces the `<sigil>query` under the caret with the chosen token and a space, and says where the caret goes. */
export function insertToken(text: string, query: MentionQuery, sigil: string, value: string): { text: string; caret: number } {
    const end = query.start + 1 + query.query.length;
    const token = `${sigil}${value} `;
    return { text: `${text.slice(0, query.start)}${token}${text.slice(end)}`, caret: query.start + token.length };
}

export function insertMention(text: string, query: MentionQuery, path: string): { text: string; caret: number } {
    return insertToken(text, query, '@', path);
}

export function insertSkill(text: string, query: MentionQuery, name: string): { text: string; caret: number } {
    return insertToken(text, query, '$', name);
}

export function insertReference(text: string, query: MentionQuery, name: string): { text: string; caret: number } {
    return insertToken(text, query, '#', name);
}

/* What a file search answered, with the query it answered, since the query moves on while the answer is on its way. */
export interface MentionSearch {
    query: string | null;
    files: string[];
}

export const NO_MENTION_SEARCH: MentionSearch = { query: null, files: [] };

/* The path Enter or Tab takes from the `@` list at `index`. Files still on screen from an older query are never taken. */
export function mentionPick(index: number, search: MentionSearch, query: string): string | null {
    if (search.query !== query) {
        return null;
    }
    return search.files[index] ?? search.files[0] ?? null;
}

function findToken(text: string, sigil: string, value: string, from: number): number {
    const token = `${sigil}${value}`;
    let index = text.indexOf(token, from);
    while (index >= 0) {
        if (isBoundary(text[index - 1]) && isTokenEnd(text[index + token.length])) {
            return index;
        }
        index = text.indexOf(token, index + 1);
    }
    return -1;
}

function present(text: string, sigil: string, chosen: string[]): string[] {
    const found: Array<{ index: number; value: string }> = [];
    for (const value of new Set(chosen)) {
        const index = findToken(text, sigil, value, 0);
        if (index >= 0) {
            found.push({ index, value });
        }
    }
    return found.sort((a, b) => a.index - b.index).map((entry) => entry.value);
}

/* The chosen mentions that still sit in the text as a whole `@path` token, in text order and without doubles. */
export function presentMentions(text: string, chosen: string[]): string[] {
    return present(text, '@', chosen);
}

/* The chosen skills that still sit in the text as a whole `$name` token, in text order and without doubles. */
export function presentSkills(text: string, chosen: string[]): string[] {
    return present(text, '$', chosen);
}

/* The ids among `ids` whose `#name` still sits in the text as a whole token, in text order and without doubles. */
export function presentReferences(text: string, ids: readonly string[], tokens: readonly ReferenceToken[]): string[] {
    const wanted = new Set(ids);
    return chipRanges(text, [], [], [], tokens)
        .map((range) => range.value)
        .filter((id, index, found) => wanted.has(id) && found.indexOf(id) === index);
}

/* The characters a segment stands for, sigil included; joined, the segments spell the text they were cut from. */
export function chipText(segment: ChipSegment): string {
    if (segment.kind === 'mention') {
        return `@${segment.path}`;
    }
    if (segment.kind === 'skill') {
        return `$${segment.name}`;
    }
    if (segment.kind === 'reference') {
        return `#${segment.name}`;
    }
    return segment.text;
}

/*
 * The paths in a pasted text that is nothing but `@path` tokens, which is what copying mentions from
 * a list of files puts on the clipboard. Any other text, an email address included, is text.
 */
export function pastedMentions(text: string): string[] {
    const tokens = text.trim().split(/\s+/);
    if (tokens.some((token) => !/^@[^\s@]+$/.test(token))) {
        return [];
    }
    return [...new Set(tokens.map((token) => token.slice(1)))];
}

export interface TextRange {
    from: number;
    to: number;
}

/* `value` is the path, the skill's name or, for a reference, its id; the range spans the name. */
export interface ChipRange extends TextRange {
    kind: 'mention' | 'skill' | 'reference';
    value: string;
}

/*
 * Where the chosen mentions, skills and references sit in the text, in text order; longer values win
 * when one prefixes another. A token that overlaps an excluded range (a code span, say) is text.
 */
export function chipRanges(
    text: string,
    mentions: string[],
    skills: string[] = [],
    excluded: readonly TextRange[] = [],
    references: readonly ReferenceToken[] = []
): ChipRange[] {
    const tokens = [
        ...[...new Set(mentions)].map((value) => ({ sigil: '@', kind: 'mention' as const, spelled: value, value })),
        ...[...new Set(skills)].map((value) => ({ sigil: '$', kind: 'skill' as const, spelled: value, value })),
        ...references.filter((token) => token.name !== '').map((token) => ({ sigil: '#', kind: 'reference' as const, spelled: token.name, value: token.id }))
    ].sort((a, b) => b.spelled.length - a.spelled.length);
    const allowed = (from: number, to: number): boolean => !excluded.some((range) => from < range.to && to > range.from);
    const ranges: ChipRange[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        let best: ChipRange | null = null;
        for (const token of tokens) {
            const length = token.spelled.length + 1;
            let index = findToken(text, token.sigil, token.spelled, cursor);
            while (index >= 0 && !allowed(index, index + length)) {
                index = findToken(text, token.sigil, token.spelled, index + 1);
            }
            if (index >= 0 && (best === null || index < best.from)) {
                best = { from: index, to: index + length, kind: token.kind, value: token.value };
            }
        }
        if (best === null) {
            break;
        }
        ranges.push(best);
        cursor = best.to;
    }
    return ranges;
}

function segmentOf(text: string, range: ChipRange): ChipSegment {
    if (range.kind === 'mention') {
        return { kind: 'mention', path: range.value };
    }
    if (range.kind === 'skill') {
        return { kind: 'skill', name: range.value };
    }
    return { kind: 'reference', id: range.value, name: text.slice(range.from + 1, range.to) };
}

/* Splits the text so a renderer can draw the mentions, skills and references as chips. */
export function tokenizeChips(text: string, mentions: string[], skills: string[] = [], references: readonly ReferenceToken[] = []): ChipSegment[] {
    return segmentsOf(text, chipRanges(text, mentions, skills, [], references));
}

// What a `#` may follow in a text nobody typed through the picker: a space, or an opening bracket or quote.
const REFERENCE_OPENER = /[\s([{"'“‘]/;

/*
 * Where a text written without the picker, such as a reply, spells `#Name` for a view, node or chat
 * by exactly its name. The longest name wins, so a name with a space is found whole. A name more
 * than one of them carries stays text, unless one of those is in `referenced`, which then wins.
 */
export function namedReferenceRanges(
    text: string,
    items: readonly ReferenceToken[],
    referenced: readonly string[] = [],
    excluded: readonly TextRange[] = []
): ChipRange[] {
    const byName = new Map<string, string[]>();
    for (const item of items) {
        if (item.name !== '') {
            byName.set(item.name, [...(byName.get(item.name) ?? []), item.id]);
        }
    }
    const names = [...byName.keys()].sort((a, b) => b.length - a.length);
    const preferred = new Set(referenced);
    const ranges: ChipRange[] = [];
    let index = text.indexOf('#');
    while (index >= 0) {
        const from = index;
        const name =
            from > 0 && !REFERENCE_OPENER.test(text[from - 1]!)
                ? undefined
                : names.find((candidate) => text.startsWith(candidate, from + 1) && isTokenEnd(text[from + 1 + candidate.length]));
        const to = name === undefined ? from + 1 : from + 1 + name.length;
        const ids = name === undefined ? [] : byName.get(name)!;
        const id = ids.find((candidate) => preferred.has(candidate)) ?? (ids.length === 1 ? ids[0] : undefined);
        if (id !== undefined && !excluded.some((range) => from < range.to && to > range.from)) {
            ranges.push({ from, to, kind: 'reference', value: id });
        }
        index = text.indexOf('#', to);
    }
    return ranges;
}

/* `namedReferenceRanges` as segments, for a renderer. */
export function tokenizeNamedReferences(text: string, items: readonly ReferenceToken[], referenced: readonly string[] = []): ChipSegment[] {
    return segmentsOf(text, namedReferenceRanges(text, items, referenced));
}

function segmentsOf(text: string, ranges: readonly ChipRange[]): ChipSegment[] {
    const segments: ChipSegment[] = [];
    let cursor = 0;
    for (const range of ranges) {
        if (range.from > cursor) {
            segments.push({ kind: 'text', text: text.slice(cursor, range.from) });
        }
        segments.push(segmentOf(text, range));
        cursor = range.to;
    }
    if (cursor < text.length) {
        segments.push({ kind: 'text', text: text.slice(cursor) });
    }
    return segments;
}
