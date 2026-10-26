import type { FileTree, FileTreeVisibleRow } from '@pierre/trees';
import { pathOfRow } from './helpers.ts';

/*
 * The engine draws only rows it holds, so the line under an open, empty directory is a child the
 * wrapper adds and removes itself. U+FDD0 is a noncharacter, which no real file name carries.
 */
const EMPTY_LINE_NAME = '﷐empty';

export type FileTreeEmptyLabel = (row: FileTreeVisibleRow) => string | undefined;

export function emptyLineOf(directory: string): string {
    return `${directory}${EMPTY_LINE_NAME}`;
}

export function isEmptyLine(path: string): boolean {
    return path.endsWith(`/${EMPTY_LINE_NAME}`);
}

export function directoryOfEmptyLine(path: string): string {
    return path.slice(0, -EMPTY_LINE_NAME.length);
}

/* An open, labeled directory that holds nothing besides its own line gets one; every other line the wrapper added goes. */
export function emptyLineChanges(
    rows: readonly FileTreeVisibleRow[],
    labelOf: FileTreeEmptyLabel,
    has: (path: string) => boolean,
    added: Iterable<string>
): { add: string[]; remove: string[] } {
    const wanted = new Set<string>();

    rows.forEach((row, index) => {
        if (row.kind !== 'directory' || !row.isExpanded) {
            return;
        }

        const line = emptyLineOf(row.path);

        for (let next = index + 1; next < rows.length && rows[next]!.depth > row.depth; next++) {
            if (rows[next]!.path !== line) {
                return;
            }
        }

        if (labelOf(row) !== undefined) {
            wanted.add(line);
        }
    });

    return {
        add: [...wanted].filter((line) => !has(line)),
        remove: [...added].filter((line) => !wanted.has(line) && has(line))
    };
}

/* Past the line the key would land on, or the focused path itself where nothing lies past it. Null when no line is in the way. */
export function pastEmptyLine(model: FileTree, key: string): string | null {
    const index = model.getFocusedIndex();
    const focused = model.getFocusedPath();

    if (index < 0 || focused === null) {
        return null;
    }

    const count = model.getVisibleCount();

    const at = (position: number): FileTreeVisibleRow | null =>
        position >= 0 && position < count ? (model.getVisibleRows(position, position)[0] ?? null) : null;

    const lineAt = (position: number): boolean => {
        const row = at(position);

        return row !== null && isEmptyLine(row.path);
    };

    const pathAt = (position: number): string => {
        const row = at(position);

        return row === null ? focused : pathOfRow(row);
    };

    if ((key === 'ArrowDown' || key === 'ArrowRight') && lineAt(index + 1)) {
        return key === 'ArrowDown' ? pathAt(index + 2) : focused;
    }

    if (key === 'ArrowUp' && lineAt(index - 1)) {
        return pathAt(index - 2);
    }

    if (key === 'End' && lineAt(count - 1)) {
        return pathAt(count - 2);
    }

    return null;
}

/* Focus that still lands on a line, through a key with a modifier or the engine giving focus back to the line's element, goes on the way the last key went. */
export function skipEmptyLine(model: FileTree, key: string): boolean {
    const path = model.getFocusedPath();

    if (path === null || !isEmptyLine(path)) {
        return false;
    }

    if (key === 'ArrowUp' || key === 'PageUp') {
        model.focusPreviousItem();

        return true;
    }

    if (key === 'ArrowDown' || key === 'PageDown' || key === 'End') {
        model.focusNextItem();
    }

    if (model.getFocusedPath() === path) {
        model.focusPath(directoryOfEmptyLine(path));
    }

    return true;
}
