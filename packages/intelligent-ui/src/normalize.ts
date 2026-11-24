import type { z } from 'zod';
import { UI_VALUE_ALIASES } from './aliases.ts';
import { UiFailure } from './budget.ts';
import type { UiValue } from './expression.ts';

/* What the catalog says about a component, as far as reading its props leniently needs it. */
export interface UiNormalEntry {
    readonly schema: { readonly shape: Readonly<Record<string, z.ZodType>> };

    /* Props that only show a number, so `12 min` reads as 12 with the unit in `unit`; without `unit` only a percent sign may follow. */
    readonly quantity?: { readonly props: readonly string[]; readonly unit?: string };

    /* A prop of rows whose columns besides `label` are numbers a chart draws. */
    readonly series?: { readonly prop: string; readonly label: string; readonly unit?: string };
}

export interface UiNormalized {
    props: Record<string, UiValue>;
    warnings: UiFailure[];
}

/* The part of a zod schema's definition this package reads. Zod has no public way to ask what a schema takes, so every such read goes through here. */
export interface UiSchemaDef {
    type: string;
    innerType?: z.ZodType;
    entries?: Record<string, unknown>;
    values?: readonly unknown[];
    options?: readonly z.ZodType[];
    defaultValue?: unknown;
}

export function uiSchemaDef(schema: z.ZodType): UiSchemaDef {
    return (schema as unknown as { def: UiSchemaDef }).def;
}

const TYPE_WORDS: Readonly<Record<string, string>> = { number: 'a number', boolean: 'true or false', string: 'text', array: 'a list', record: 'a record' };
const NUMBER = /^-?\d+(?:\.\d+)?$/;
// A number, then a unit that holds no digit, so `21 min 38 sec` and `1,5` stay the text they are.
const QUANTITY = /^(-?\d+(?:\.\d+)?)\s*([^\d\s.,-][^\d]*)?$/;

/* The schema a prop is checked against once it is given: an optional or defaulted one without its wrapper. */
export function uiInnerSchema(schema: z.ZodType): z.ZodType {
    const def = uiSchemaDef(schema);
    const wrapped = def.type === 'optional' || def.type === 'default' || def.type === 'nullable';

    return wrapped && def.innerType ? uiInnerSchema(def.innerType) : schema;
}

function typeOf(schema: z.ZodType): string {
    return uiSchemaDef(uiInnerSchema(schema)).type;
}

/* What a prop takes, in the words of a message. */
function described(schema: z.ZodType): string {
    const def = uiSchemaDef(uiInnerSchema(schema));

    return def.type === 'union' ? [...new Set((def.options ?? []).map(described))].join(' or ') : (TYPE_WORDS[def.type] ?? def.type);
}

/* The values an enum or a literal prop takes, or null for any other prop. */
export function uiPropOptions(schema: z.ZodType): string[] | null {
    const def = uiSchemaDef(uiInnerSchema(schema));

    if (def.type === 'enum') {
        return Object.keys(def.entries ?? {});
    }

    return def.type === 'literal' ? (def.values ?? []).map(String) : null;
}

/* How a prop is written with this value: quoted for text, braced for the rest. */
export function uiWritten(key: string, value: unknown): string {
    return typeof value === 'string' ? `${key}=${JSON.stringify(value)}` : `${key}={${JSON.stringify(value)}}`;
}

function clipped(value: unknown): string {
    const text = JSON.stringify(value) ?? 'undefined';

    return text.length > 48 ? `${text.slice(0, 45)}...` : text;
}

/* `value` as the type the schema asks for, where that loses nothing; otherwise `value` itself. */
function coerced(schema: z.ZodType, value: UiValue): UiValue {
    const type = typeOf(schema);

    if (type === 'number' && typeof value === 'string' && NUMBER.test(value.trim())) {
        return Number(value.trim());
    }

    if (type === 'boolean' && typeof value === 'string' && /^(?:true|false)$/i.test(value.trim())) {
        return value.trim().toLowerCase() === 'true';
    }

    if (type === 'string' && (typeof value === 'number' || typeof value === 'boolean')) {
        return String(value);
    }

    if ((type === 'array' || type === 'record') && typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);

            if (parsed !== null && typeof parsed === 'object' && Array.isArray(parsed) === (type === 'array')) {
                return parsed as UiValue;
            }
        } catch {
            // Text that is no JSON stays the text the schema refuses.
        }
    }

    return value;
}

interface Quantity {
    value: number;
    unit: string;
}

function quantityOf(value: unknown): Quantity | null {
    const match = typeof value === 'string' ? QUANTITY.exec(value.trim()) : null;

    return match ? { value: Number(match[1]), unit: (match[2] ?? '').trim() } : null;
}

/*
 * The quantity props an agent wrote as text, read as numbers when they share one unit and it does
 * not contradict a unit that is written. Anything else is left as written, since two units cannot
 * be compared without a guess.
 */
function readQuantities(type: string, entry: UiNormalEntry, props: Record<string, UiValue>, warnings: UiFailure[]): void {
    const quantity = entry.quantity;

    if (!quantity) {
        return;
    }

    const read = quantity.props.flatMap((key) => {
        const found = quantityOf(props[key]);

        return found ? [{ key, ...found }] : [];
    });

    const units = new Set(read.map((item) => item.unit).filter((unit) => unit !== ''));
    const [unit] = [...units];

    if (read.length === 0 || units.size > 1) {
        return;
    }

    if (unit !== undefined) {
        const given = quantity.unit === undefined ? undefined : props[quantity.unit];

        // Without a prop for the unit only a percentage reads as its number.
        if (quantity.unit === undefined ? unit !== '%' : given !== undefined && given !== unit) {
            return;
        }

        // A number beside one with a unit would silently take that unit.
        if (quantity.props.some((key) => typeof props[key] === 'number')) {
            return;
        }
    }

    for (const item of read) {
        const written = props[item.key];
        const both = quantity.unit !== undefined && unit !== undefined ? ` ${uiWritten(quantity.unit, unit)}` : '';

        props[item.key] = item.value;

        warnings.push(
            new UiFailure(
                'coerced_prop',
                `${type} ${item.key} takes a number: write ${uiWritten(item.key, item.value)}${both}, not ${uiWritten(item.key, written)}; read as that.`
            )
        );
    }

    if (quantity.unit !== undefined && unit !== undefined) {
        props[quantity.unit] = unit;
    }
}

/* The columns of chart rows an agent wrote as text, read as numbers when every value of the column is one, with the unit they share. */
function readSeries(type: string, entry: UiNormalEntry, props: Record<string, UiValue>, warnings: UiFailure[]): void {
    const series = entry.series;
    const rows = series ? props[series.prop] : undefined;

    if (!series || !Array.isArray(rows) || !rows.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row))) {
        return;
    }

    const records = rows as Record<string, UiValue>[];
    const keys = new Set(records.flatMap((row) => Object.keys(row)));
    const units = new Set<string>();
    const columns: string[] = [];

    keys.delete(series.label);

    for (const key of keys) {
        const values = records.map((row) => row[key]).filter((value) => value !== undefined && value !== null && value !== '');
        const read = values.flatMap((value) => (typeof value === 'number' ? [{ value, unit: '' }] : (quantityOf(value) ?? [])));

        if (values.some((value) => typeof value === 'string') && read.length === values.length) {
            columns.push(key);

            for (const item of read) {
                units.add(item.unit);
            }
        }
    }

    units.delete('');

    if (columns.length === 0 || units.size > 1) {
        return;
    }

    const [unit] = [...units];
    const given = series.unit === undefined ? undefined : props[series.unit];

    if (unit !== undefined && (series.unit === undefined || (given !== undefined && given !== unit))) {
        return;
    }

    props[series.prop] = records.map((row) => {
        const next = { ...row };

        for (const key of columns) {
            const found = quantityOf(next[key]);

            if (found) {
                next[key] = found.value;
            }
        }

        return next;
    });

    if (series.unit !== undefined && unit !== undefined) {
        props[series.unit] = unit;
    }

    warnings.push(
        new UiFailure(
            'coerced_prop',
            `${type} ${series.prop} takes numbers for ${columns.join(', ')}: write {"${columns[0]}": 12}, not {"${columns[0]}": "12"}; read as that.`
        )
    );
}

/*
 * The props of a component as its schema can read them: a quantity or a value written in another
 * type as that type, a synonym of an enum value as the value, and an optional prop nothing could
 * read left out. Every change comes with a warning that says how the prop is written. What is
 * still wrong afterwards is left for the schema to refuse.
 */
export function normalizeUiProps(type: string, entry: UiNormalEntry, written: Readonly<Record<string, UiValue>>): UiNormalized {
    const props: Record<string, UiValue> = { ...written };
    const warnings: UiFailure[] = [];
    const { shape } = entry.schema;
    let dropped = false;

    readQuantities(type, entry, props, warnings);
    readSeries(type, entry, props, warnings);

    for (const [key, value] of Object.entries(props)) {
        if (!Object.hasOwn(shape, key)) {
            continue;
        }

        const schema = uiInnerSchema(shape[key]);

        if (schema.safeParse(value).success) {
            continue;
        }

        const options = uiPropOptions(schema);
        let next = value;

        if (options !== null && typeof value === 'string') {
            const word = value.trim().toLowerCase();
            const read = options.includes(word) ? word : UI_VALUE_ALIASES[key]?.[word];

            if (read !== undefined && options.includes(read)) {
                next = read;
                warnings.push(new UiFailure('renamed_value', `${type} ${key} is "${read}", not "${value}"; read as "${read}".`));
            }
        } else {
            next = coerced(schema, value);

            if (next !== value && schema.safeParse(next).success) {
                warnings.push(
                    new UiFailure(
                        'coerced_prop',
                        `${type} ${key} takes ${described(schema)}: write ${uiWritten(key, next)}, not ${uiWritten(key, value)}; read as that.`
                    )
                );
            }
        }

        if (schema.safeParse(next).success) {
            props[key] = next;
        } else if (shape[key].isOptional() && (options !== null || !ofType(schema, next))) {
            dropped = true;
            delete props[key];
            warnings.push(
                new UiFailure(
                    'dropped_prop',
                    `${type} ${key}=${clipped(value)} is not valid${options === null ? '' : `, it is one of ${options.join(', ')}`}; left out.`
                )
            );
        }
    }

    // A quantity whose neighbor was left out stands alone now, and reads as one.
    if (dropped) {
        readQuantities(type, entry, props, warnings);
    }

    return { props, warnings };
}

/*
 * Whether a value is of the kind a prop takes. One that is, and still fails its schema, is out of
 * range: a latitude of 200 is a mistake to report, where a tone nobody knows is one to leave out.
 */
function ofType(schema: z.ZodType, value: unknown): boolean {
    const type = typeOf(schema);

    if (type === 'array') {
        return Array.isArray(value);
    }

    return type === 'string' || type === 'number' || type === 'boolean' ? typeof value === type : true;
}

/* What the schema refused, said per prop with the component's name and what the prop takes. */
export function uiPropsMessage(type: string, entry: UiNormalEntry, props: Readonly<Record<string, unknown>>, issues: readonly z.core.$ZodIssue[]): string {
    const lines = issues.map((issue) => {
        const key = issue.path[0];

        if (typeof key !== 'string' || !Object.hasOwn(entry.schema.shape, key)) {
            return `${type}: ${issue.message}`;
        }

        const schema = entry.schema.shape[key];
        const options = uiPropOptions(schema);
        const value = props[key];

        if (value === undefined) {
            return options === null ? `${type} needs ${key}, ${described(schema)}.` : `${type} needs ${key}, one of ${options.join(', ')}.`;
        }

        if (options !== null) {
            return `${type} ${key} is one of ${options.join(', ')}; got ${clipped(value)}.`;
        }

        return issue.path.length === 1 && issue.code === 'invalid_type'
            ? `${type} ${key} takes ${described(schema)}; got ${clipped(value)}.`
            : `${type} ${issue.path.join('.')}: ${issue.message}`;
    });

    return [...new Set(lines)].join(' ');
}
