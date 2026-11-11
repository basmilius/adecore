import { z } from 'zod';

/*
 * What a newer host may add to a schema without an older client refusing the whole reply or event. A stamp is only
 * metadata: a strict parse ignores it, so a host keeps refusing what it receives. Only a client reading what a host
 * sent applies it, through `readTolerant`, and a generator for another language can read the same stamps.
 */
export type WireStamp =
    | {
          readonly open: 'union';
          readonly name: string;
          readonly tag: string;
          readonly base: readonly string[];
      }
    | { readonly open: 'items' }
    | {
          readonly open: 'values';
          readonly name: string;
          readonly words: 'cases' | 'strings';
          readonly known: readonly string[];
      };

export interface WireStampAt {
    readonly path: readonly (string | number)[];
    readonly stamp: WireStamp;
}

/* What `readTolerant` gave up on to read the rest, at the path of the input it happened at. */
export type WireDegradation =
    | { readonly kind: 'unknown-member'; readonly path: readonly (string | number)[]; readonly name: string; readonly tag: string }
    | { readonly kind: 'dropped-element'; readonly path: readonly (string | number)[] }
    | { readonly kind: 'unknown-word'; readonly path: readonly (string | number)[]; readonly name: string; readonly word: string };

// Keyed by the schema object, so the stamps hold whichever copy of zod built the schema.
const stamps = new WeakMap<object, WireStamp>();
// Whether a schema has a stamp at or below it; a host may stamp its own schemas after these, so a new stamp starts it over.
let stampedBelow = new WeakMap<object, boolean>();

function stamp(schema: object, value: WireStamp): void {
    stamps.set(schema, value);
    stampedBelow = new WeakMap();
}

/*
 * A union a newer host may add a member to, or a value inside a member. A member that does not read keeps its place as
 * `{ [tag]: 'unknown', ...base, raw }` once its tag is a string and every field in `base` reads with the first member's schema.
 */
export function openUnion<S extends z.core.$ZodType>(schema: S, name: string, options: { readonly tag: string; readonly base: readonly string[] }): S {
    const members = optionsOf(schema);

    if (members === null || members.some((member) => propValues(member, options.tag) === null)) {
        throw new Error(`${name} cannot be an open union: every member needs a ${options.tag} literal`);
    }

    if (members.some((member) => propValues(member, options.tag)?.has('unknown'))) {
        throw new Error(`${name} cannot be an open union: no member may be tagged unknown`);
    }

    stamp(schema, { open: 'union', name, tag: options.tag, base: [...options.base] });

    return schema;
}

/* A list that leaves out an element it cannot read, so one newer entry does not empty the page it is on. */
export function lossyItems<S extends z.core.$ZodType>(schema: S): S {
    if (defOf(schema).type !== 'array') {
        throw new Error('Only an array can leave out an element');
    }

    stamp(schema, { open: 'items' });

    return schema;
}

/*
 * A vocabulary a newer host may add a word to. A word this version does not know is kept as it came. `words` says how a
 * typed client models the known ones: as `cases` beside an unknown one, or as plain `strings`. A string schema is already
 * open, so it takes the stamp only to name its `known` words for such a client, which reads them as `strings`.
 */
export function openValues<S extends z.core.$ZodType>(
    schema: S,
    name: string,
    options: { readonly words?: 'cases' | 'strings'; readonly known?: readonly string[] } = {}
): S {
    const def = defOf(schema);

    if (def.type === 'string' && options.known !== undefined) {
        stamp(schema, { open: 'values', name, words: 'strings', known: [...options.known] });

        return schema;
    }

    if (def.type !== 'enum' || def.entries === undefined) {
        throw new Error(`${name} cannot take open values: only an enum can, or a string that names its known words`);
    }

    stamp(schema, { open: 'values', name, words: options.words ?? 'cases', known: [...(options.known ?? Object.values(def.entries).map(String))] });

    return schema;
}

/* The stamp on this very schema object, for a generator that walks a schema itself. */
export function wireStampOf(schema: object): WireStamp | undefined {
    return stamps.get(schema);
}

/* Every stamp reachable from `schema`, with the path of the input it applies at (`[]` for an array element, `{}` for a record value). */
export function wireStampsIn(schema: z.core.$ZodType): WireStampAt[] {
    const found: WireStampAt[] = [];
    const seen = new Set<object>();

    const visit = (node: z.core.$ZodType, path: (string | number)[]): void => {
        if (seen.has(node)) {
            return;
        }

        seen.add(node);

        const stamp = stamps.get(node);

        if (stamp !== undefined) {
            found.push({ path, stamp });
        }

        for (const [key, child] of childrenOf(node)) {
            visit(child, key === null ? path : [...path, key]);
        }

        seen.delete(node);
    };

    visit(schema, []);

    return found;
}

export type StampedRead =
    | { readonly success: true; readonly data: unknown; readonly degraded: readonly WireDegradation[] }
    | { readonly success: false; readonly error: z.ZodError };

/*
 * Reads what a host sent: strictly when that works, so a reply this version fully knows comes out exactly as a strict
 * parse makes it. Otherwise each stamp degrades the nearest open container around what failed and the rest is read as
 * strictly as before; what has no open container around it refuses the whole input, as a strict parse does.
 */
export function readStamped(schema: z.core.$ZodType, input: unknown): StampedRead {
    const strict = z.safeParse(schema, input);

    if (strict.success) {
        return { success: true, data: strict.data, degraded: [] };
    }

    const degraded: WireDegradation[] = [];
    const read = walk(schema, input, [], degraded);

    return read === FAILED ? { success: false, error: strict.error } : { success: true, data: read.value, degraded };
}

interface Def {
    readonly type: string;
    readonly shape?: Record<string, z.core.$ZodType>;
    readonly catchall?: z.core.$ZodType;
    readonly element?: z.core.$ZodType;
    readonly innerType?: z.core.$ZodType;
    readonly options?: readonly z.core.$ZodType[];
    readonly discriminator?: string;
    readonly keyType?: z.core.$ZodType;
    readonly valueType?: z.core.$ZodType;
    readonly entries?: Record<string, string | number>;
    readonly checks?: readonly unknown[];
    readonly getter?: () => z.core.$ZodType;
}

const FAILED = Symbol('failed');

type Walked = { readonly value: unknown } | typeof FAILED;

function defOf(schema: z.core.$ZodType): Def {
    return schema._zod.def as unknown as Def;
}

function optionsOf(schema: z.core.$ZodType): readonly z.core.$ZodType[] | null {
    const def = defOf(schema);

    return def.type === 'union' && def.options !== undefined ? def.options : null;
}

function propValues(member: z.core.$ZodType, tag: string): ReadonlySet<unknown> | null {
    return (member._zod as { propValues?: Record<string, Set<unknown>> }).propValues?.[tag] ?? null;
}

// The schemas a value of `schema` is read with, by the key of the input they read (`null` for a wrapper of the same value).
function childrenOf(schema: z.core.$ZodType): [string | number | null, z.core.$ZodType][] {
    const def = defOf(schema);

    switch (def.type) {
        case 'object':
            return [...Object.entries(def.shape ?? {}), ...(def.catchall === undefined ? [] : [['{}', def.catchall] as [string, z.core.$ZodType]])];
        case 'array':
            return def.element === undefined ? [] : [['[]', def.element]];
        case 'record':
            return def.valueType === undefined ? [] : [['{}', def.valueType]];
        case 'union':
            return (def.options ?? []).map((option) => [null, option]);
        case 'optional':
        case 'nullable':
        case 'default':
        case 'prefault':
        case 'readonly':
        case 'nonoptional':
        case 'catch':
            return def.innerType === undefined ? [] : [[null, def.innerType]];
        case 'lazy':
            return def.getter === undefined ? [] : [[null, def.getter()]];
        default:
            return [];
    }
}

function hasStamp(schema: z.core.$ZodType): boolean {
    const known = stampedBelow.get(schema);

    if (known !== undefined) {
        return known;
    }

    const result = wireStampsIn(schema).length > 0;

    stampedBelow.set(schema, result);

    return result;
}

function strictly(schema: z.core.$ZodType, input: unknown): Walked {
    const parsed = z.safeParse(schema, input);

    return parsed.success ? { value: parsed.data } : FAILED;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function walk(schema: z.core.$ZodType, input: unknown, path: (string | number)[], degraded: WireDegradation[]): Walked {
    if (!hasStamp(schema)) {
        return strictly(schema, input);
    }

    const stamp = stamps.get(schema);

    if (stamp?.open === 'values') {
        const read = strictly(schema, input);

        // A string schema takes any word itself, so only an enum has a word to keep that a strict parse refused.
        if (read !== FAILED || typeof input !== 'string' || defOf(schema).type !== 'enum') {
            return read;
        }

        degraded.push({ kind: 'unknown-word', path, name: stamp.name, word: input });

        return { value: input };
    }

    if (stamp?.open === 'union') {
        return walkOpenUnion(schema, stamp, input, path, degraded);
    }

    const def = defOf(schema);

    // A check over a whole container cannot run on a value with a degraded part, so such a container stays strict.
    if ((def.checks?.length ?? 0) > 0) {
        return strictly(schema, input);
    }

    switch (def.type) {
        case 'object':
            return walkObject(def, input, path, degraded);
        case 'array':
            // A list of an open union leaves out a member without the fields every member shares, which has no place to keep.
            return walkArray(def, stamp?.open === 'items' || (def.element !== undefined && stamps.get(def.element)?.open === 'union'), input, path, degraded);
        case 'record':
            return walkRecord(def, input, path, degraded);
        case 'union':
            return walkUnion(def, input, path, degraded);
        case 'optional':
            return input === undefined ? { value: undefined } : walk(def.innerType!, input, path, degraded);
        case 'nullable':
            return input === null ? { value: null } : walk(def.innerType!, input, path, degraded);
        case 'default':
        case 'prefault':
            return input === undefined ? strictly(schema, input) : walk(def.innerType!, input, path, degraded);
        case 'readonly':
        case 'nonoptional':
            return walk(def.innerType!, input, path, degraded);
        case 'lazy':
            return walk(def.getter!(), input, path, degraded);
        default:
            return strictly(schema, input);
    }
}

function walkOpenUnion(
    schema: z.core.$ZodType,
    stamp: Extract<WireStamp, { open: 'union' }>,
    input: unknown,
    path: (string | number)[],
    degraded: WireDegradation[]
): Walked {
    const word = isRecord(input) ? input[stamp.tag] : undefined;

    if (!isRecord(input) || typeof word !== 'string') {
        return FAILED;
    }

    const members = optionsOf(schema) ?? [];
    const member = members.find((candidate) => propValues(candidate, stamp.tag)?.has(word));

    if (member !== undefined) {
        const mark = degraded.length;
        const read = walk(member, input, path, degraded);

        if (read !== FAILED) {
            return read;
        }

        degraded.length = mark;
    }

    const shape = defOf(members[0]!).shape ?? {};
    const base: Record<string, unknown> = {};

    for (const key of stamp.base) {
        const field = shape[key];
        const read = field === undefined || !(key in input) ? FAILED : strictly(field, input[key]);

        if (read === FAILED) {
            return FAILED;
        }

        base[key] = read.value;
    }

    degraded.push({ kind: 'unknown-member', path, name: stamp.name, tag: word });

    return { value: { ...base, [stamp.tag]: 'unknown', raw: input } };
}

function walkObject(def: Def, input: unknown, path: (string | number)[], degraded: WireDegradation[]): Walked {
    if (!isRecord(input)) {
        return FAILED;
    }

    const shape = def.shape ?? {};
    const output: Record<string, unknown> = {};

    for (const [key, field] of Object.entries(shape)) {
        const present = key in input;

        // As zod does: an absent optional key adds nothing, not even an `undefined`.
        if (!present && field._zod.optin === 'optional' && field._zod.optout === 'optional') {
            continue;
        }

        const read = walk(field, input[key], [...path, key], degraded);

        if (read === FAILED) {
            return FAILED;
        }

        if (read.value !== undefined || present || field._zod.optin === 'defaulted') {
            output[key] = read.value;
        }
    }

    if (def.catchall === undefined) {
        return { value: output };
    }

    const catchall = defOf(def.catchall).type;

    for (const [key, value] of Object.entries(input)) {
        if (Object.hasOwn(shape, key) || key === '__proto__') {
            continue;
        }

        if (catchall === 'never') {
            return FAILED;
        }

        const read = walk(def.catchall, value, [...path, key], degraded);

        if (read === FAILED) {
            return FAILED;
        }

        output[key] = read.value;
    }

    return { value: output };
}

function walkArray(def: Def, lossy: boolean, input: unknown, path: (string | number)[], degraded: WireDegradation[]): Walked {
    if (!Array.isArray(input) || def.element === undefined) {
        return FAILED;
    }

    const output: unknown[] = [];

    for (const [i, element] of input.entries()) {
        // An element left out takes back what it degraded, so the list only names the element itself.
        const mark = degraded.length;
        const read = walk(def.element, element, [...path, i], degraded);

        if (read !== FAILED) {
            output.push(read.value);

            continue;
        }

        if (!lossy) {
            return FAILED;
        }

        degraded.length = mark;
        degraded.push({ kind: 'dropped-element', path: [...path, i] });
    }

    return { value: output };
}

function walkRecord(def: Def, input: unknown, path: (string | number)[], degraded: WireDegradation[]): Walked {
    if (!isRecord(input) || def.keyType === undefined || def.valueType === undefined) {
        return FAILED;
    }

    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
        const name = strictly(def.keyType, key);
        const read = name === FAILED ? FAILED : walk(def.valueType, value, [...path, key], degraded);

        if (name === FAILED || read === FAILED) {
            return FAILED;
        }

        output[String(name.value)] = read.value;
    }

    return { value: output };
}

function walkUnion(def: Def, input: unknown, path: (string | number)[], degraded: WireDegradation[]): Walked {
    const tag = def.discriminator;
    const word = tag !== undefined && isRecord(input) ? input[tag] : undefined;

    for (const option of def.options ?? []) {
        if (tag !== undefined && !propValues(option, tag)?.has(word)) {
            continue;
        }

        const mark = degraded.length;
        const read = walk(option, input, path, degraded);

        if (read !== FAILED) {
            return read;
        }

        degraded.length = mark;
    }

    return FAILED;
}
