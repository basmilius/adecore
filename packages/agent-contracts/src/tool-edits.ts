import { isRecord } from '@adecore/utils/record';

/* One replacement a tool call makes in a file; a write has no `before`. */
export interface ToolFileEditPiece {
    before: string;
    after: string;
}

/* A file a tool call changes: a write replaces the file whole, an edit replaces pieces of it. */
export interface ToolFileEdit {
    path: string;
    write: boolean;
    pieces: ToolFileEditPiece[];
}

function text(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function piece(edit: Record<string, unknown>): ToolFileEditPiece {
    return { before: text(edit.old_string) ?? '', after: text(edit.new_string) ?? '' };
}

/*
 * The file an `Edit`, `Write` or `MultiEdit` call changes, from its input (the Apple backend uses the
 * same names). Null for any other tool, and for a call that names no `file_path` or, for `MultiEdit`,
 * no `edits` list. The diffs a provider reports with a call (`changes`) are not read here.
 */
export function toolFileEdit(name: string, input: unknown): ToolFileEdit | null {
    if (!isRecord(input)) {
        return null;
    }

    const path = text(input.file_path);

    if (path === null) {
        return null;
    }

    if (name === 'Edit') {
        return { path, write: false, pieces: [piece(input)] };
    }

    if (name === 'Write') {
        return { path, write: true, pieces: [{ before: '', after: text(input.content) ?? '' }] };
    }

    if (name === 'MultiEdit' && Array.isArray(input.edits)) {
        return { path, write: false, pieces: input.edits.filter(isRecord).map(piece) };
    }

    return null;
}
