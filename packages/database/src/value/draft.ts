import { parseDraft } from '../grid/edit-value.ts';
import type { GridColumn } from '../grid/types.ts';
import type { EditValue, Value } from '../protocol/index.ts';
import { parseHex, type HexProblem } from './hex.ts';
import { checkJson, isJsonDocument } from './json.ts';

/* What the editor holds: the text of a value, or a NULL or a DEFAULT that has no text. */
export interface Draft {
    readonly text: string;
    readonly mode: 'value' | 'null' | 'default';
}

/* What a draft starts from, and what tells a new cell from the same one. */
export interface Source {
    readonly name: string;
    readonly type: string;
    readonly kind: GridColumn['kind'];
    readonly binary: boolean;
    readonly json: boolean;
    readonly original: Draft;
}

export type DraftProblem = { readonly kind: 'json'; readonly reason: string } | { readonly kind: 'hex'; readonly problem: HexProblem };

export type Conversion = { readonly ok: true; readonly value: EditValue } | { readonly ok: false; readonly problem: DraftProblem };

/* The text a value is edited as: a binary value as its hex, everything else as it is written. */
const textOf = (value: Exclude<Value, null>): string => {
    if (typeof value === 'object') {
        return value.hex;
    }
    return String(value);
};

export const sourceOf = (column: Pick<GridColumn, 'name' | 'type' | 'kind'>, value: Value): Source => {
    const binary = column.kind === 'binary' || (value !== null && typeof value === 'object');
    const original: Draft = value === null ? { text: '', mode: 'null' } : { text: textOf(value), mode: 'value' };
    return {
        name: column.name,
        type: column.type,
        kind: column.kind,
        binary,
        json: !binary && (column.kind === 'json' ? value !== null : typeof value === 'string' && isJsonDocument(value)),
        original
    };
};

export const sameSource = (a: Source, b: Source): boolean =>
    a.name === b.name && a.type === b.type && a.kind === b.kind && a.binary === b.binary && a.json === b.json && sameDraft(a.original, b.original);

export const sameDraft = (a: Draft, b: Draft): boolean => a.mode === b.mode && (a.mode !== 'value' || a.text === b.text);

/* A draft becomes the value to send. Text goes as text, and a number only where the column holds numbers and the text spells one. */
export const editValueOf = (draft: Draft, source: Source): Conversion => {
    if (draft.mode === 'null') {
        return { ok: true, value: null };
    }
    if (draft.mode === 'default') {
        return { ok: true, value: { kind: 'default' } };
    }
    if (source.binary) {
        const parsed = parseHex(draft.text);
        return parsed.ok ? { ok: true, value: { kind: 'binary', hex: parsed.hex } } : { ok: false, problem: { kind: 'hex', problem: parsed.problem } };
    }
    if (source.json) {
        const checked = checkJson(draft.text);
        if (!checked.ok) {
            return { ok: false, problem: { kind: 'json', reason: checked.reason } };
        }
    }
    return { ok: true, value: parseDraft(draft.text, source.kind) };
};
