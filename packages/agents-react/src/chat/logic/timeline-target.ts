import type { ChatItem } from '@adecore/agent-contracts';
import type { TimelineRow } from './timeline';
import { selectionWithin } from '@adecore/ui';
import type { FileRef } from '../../host';

/* What the right-click landed on, read once when the menu opens. */
export interface TimelineTarget {
    /* The text selected inside the thread; a selection elsewhere is none of this menu's business. */
    selection: string;
    row: TimelineRow | null;
    /* The code block under the pointer, when the click landed in one. */
    code: string | null;
    /* The file a mention chip, a changed-files row or a link in an answer names. */
    path: string | null;
    /* The line that file reference named, where it named one. */
    line: number | null;
    /* Captured at menu opening, before the rendering scope or cwd can change. */
    file?: { ref: FileRef; cwd: string | null; scopeId: string | null } | null;
}

export const EMPTY_TARGET: TimelineTarget = { selection: '', row: null, code: null, path: null, line: null };

/*
 * The rows with the text a reply or a thought holds now. Rows are derived from the structure of a
 * thread, which a delta leaves alone, so a row still carries the text it was derived with.
 */
export function withCurrentText(rows: TimelineRow[], items: Record<string, ChatItem> | undefined): TimelineRow[] {
    if (!items) {
        return rows;
    }
    return rows.map((row) => {
        const item = items[row.id];
        if (row.kind === 'assistant' && item?.kind === 'assistant') {
            return { ...row, item };
        }
        if (row.kind === 'thinking' && item?.kind === 'thinking') {
            return { ...row, item };
        }
        return row;
    });
}

/* The row a click landed in is the one whose id it sits under; the rest comes from the same walk up. */
export function readTimelineTarget(element: HTMLElement, scroller: HTMLElement | null, rows: TimelineRow[]): TimelineTarget {
    const id = element.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
    const file = element.closest<HTMLElement>('[data-file-path]');
    const line = positiveInteger(file?.dataset.fileLine);
    const column = positiveInteger(file?.dataset.fileColumn);
    const endLine = positiveInteger(file?.dataset.fileEndLine);
    const path = file?.dataset.filePath ?? null;
    return {
        selection: selectionWithin(scroller),
        row: rows.find((row) => row.id === id) ?? null,
        code: element.closest('pre')?.textContent ?? null,
        path,
        line,
        file:
            path === null
                ? null
                : {
                      ref: {
                          path,
                          ...(line === null ? {} : { line }),
                          ...(column === null ? {} : { column }),
                          ...(line === null || endLine === null || endLine < line ? {} : { endLine }),
                          directory: file?.dataset.fileDirectory === 'true'
                      },
                      cwd: file?.closest<HTMLElement>('[data-file-cwd]')?.dataset.fileCwd || null,
                      scopeId: file?.closest<HTMLElement>('[data-file-scope-id]')?.dataset.fileScopeId || null
                  }
    };
}

function positiveInteger(value: string | undefined): number | null {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
}
