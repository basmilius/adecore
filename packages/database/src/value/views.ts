import type { Draft, DraftProblem, Source } from './draft.ts';
import { decodeUtf8, formatUuid, hexDumpLines, parseHex } from './hex.ts';
import { checkJson, prettyJson } from './json.ts';

export type ViewId = 'text' | 'formatted' | 'hex' | 'utf8' | 'uuid';

export const viewsOf = (source: Source, draft: Draft): ViewId[] => {
    if (source.binary) {
        const parsed = parseHex(draft.text);
        const hex = parsed.ok ? parsed.hex : source.original.text;

        return formatUuid(hex) === null ? ['hex', 'utf8'] : ['hex', 'utf8', 'uuid'];
    }

    return source.json ? ['formatted', 'text'] : ['text'];
};

export const sizeOf = (source: Source, draft: Draft): { unit: 'bytes' | 'characters'; count: number } | null => {
    if (draft.mode !== 'value') {
        return null;
    }

    if (!source.binary) {
        return { unit: 'characters', count: draft.text.length };
    }

    const parsed = parseHex(draft.text);

    return parsed.ok ? { unit: 'bytes', count: parsed.hex.length / 2 } : null;
};

/* A read only view stops its dump here; the text view and a copy are not limited. */
const DUMP_LIMIT_BYTES = 16 * 1024;

export type Rendered =
    | { readonly kind: 'empty' }
    | { readonly kind: 'text'; readonly text: string; readonly truncated?: { readonly shown: number; readonly total: number } }
    | { readonly kind: 'problem'; readonly problem: DraftProblem };

/* What a read only view shows for the draft. The text view is not here, since it is the editor itself. */
export const renderView = (view: Exclude<ViewId, 'text'>, draft: Draft): Rendered => {
    if (draft.mode !== 'value') {
        return { kind: 'empty' };
    }

    if (view === 'formatted') {
        const pretty = prettyJson(draft.text);

        if (pretty !== null) {
            return { kind: 'text', text: pretty };
        }

        const checked = checkJson(draft.text);

        return { kind: 'problem', problem: { kind: 'json', reason: checked.ok ? '' : checked.reason } };
    }

    const parsed = parseHex(draft.text);

    if (!parsed.ok) {
        return { kind: 'problem', problem: { kind: 'hex', problem: parsed.problem } };
    }

    if (view === 'utf8') {
        return { kind: 'text', text: decodeUtf8(parsed.hex) };
    }

    if (view === 'uuid') {
        return { kind: 'text', text: formatUuid(parsed.hex) ?? '' };
    }

    const total = parsed.hex.length / 2;

    return {
        kind: 'text',
        text: hexDumpLines(parsed.hex, DUMP_LIMIT_BYTES).join('\n'),
        truncated: total > DUMP_LIMIT_BYTES ? { shown: DUMP_LIMIT_BYTES, total } : undefined
    };
};
