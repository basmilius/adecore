const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

interface OpenHunk {
    /* Where its header stands in the kept lines. */
    at: number;
    oldStart: number;
    newStart: number;
    /* The counts its header was written with. */
    oldWritten: number;
    newWritten: number;
    rest: string;
    old: number;
    new: number;
}

/* A side the cut left without lines names the line before it, as a hunk that never had lines on that side does. */
function side(start: number, count: number, written: number): string {
    return `${count === 0 && written > 0 ? Math.max(0, start - 1) : start},${count}`;
}

/*
 * A unified patch cut to its first `limit` lines of change and context. The file header stays, and the hunk
 * the cut falls in gets the counts of what is left of it, so the shorter patch still parses as a whole one.
 */
export function uiClipPatch(patch: string, limit: number): { patch: string; clipped: boolean } {
    const lines = patch.split('\n');
    const kept: string[] = [];
    let hunk: OpenHunk | null = null;
    let count = 0;

    for (const [index, line] of lines.entries()) {
        const header = HUNK.exec(line);

        if (header !== null) {
            if (count >= limit) {
                return { patch: kept.join('\n'), clipped: true };
            }

            hunk = {
                at: kept.length,
                oldStart: Number(header[1]),
                newStart: Number(header[3]),
                oldWritten: Number(header[2] ?? 1),
                newWritten: Number(header[4] ?? 1),
                rest: header[5] ?? '',
                old: 0,
                new: 0
            };
            kept.push(line);

            continue;
        }

        // A stripped empty line inside a hunk is context; the one a final newline leaves at the very end is not.
        const body = hunk !== null && (/^[ +-]/.test(line) || (line === '' && index < lines.length - 1));

        if (hunk === null || (!body && !line.startsWith('\\'))) {
            hunk = null;
            kept.push(line);

            continue;
        }

        if (!body) {
            kept.push(line);

            continue;
        }

        if (count >= limit) {
            kept[hunk.at] = `@@ -${side(hunk.oldStart, hunk.old, hunk.oldWritten)} +${side(hunk.newStart, hunk.new, hunk.newWritten)} @@${hunk.rest}`;

            return { patch: kept.join('\n'), clipped: true };
        }

        hunk.old += line.startsWith('+') ? 0 : 1;
        hunk.new += line.startsWith('-') ? 0 : 1;
        count += 1;
        kept.push(line);
    }

    return { patch, clipped: false };
}
