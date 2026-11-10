/*
 * How every no reads: `refused`, the code a script branches on and the sentence a model reads, and
 * under it a line per thing the actor can do instead. A line keeps its tabs but loses its newlines,
 * since everything under the first row is read as advice.
 */

/* A field that goes into a tab-separated line; a tab or a newline in a title would split the row. */
export function field(value: string): string {
    return value.replace(/[\t\r\n]+/g, ' ');
}

function row(line: string): string {
    return line.replace(/[\r\n]+/g, ' ');
}

function rows(code: string, message: string, lines: readonly string[]): string[] {
    return [`${field(code)}\t${field(message)}`, ...lines.map(row)];
}

/* What a verb is refused with, whole: the `refused` row and what to do instead under it. */
export function refusalBody(code: string, message: string, lines: readonly string[] = []): string {
    const [first, ...rest] = rows(code, message, lines);

    return [`refused\t${first}`, ...rest].join('\n');
}

/* Without the `refused` prefix, for a host whose CLI adds it, so a CLI of an older build still prints one refusal. */
export function refusalRows(code: string, message: string, lines: readonly string[] = []): string {
    return rows(code, message, lines).join('\n');
}

export interface ParsedRefusal {
    code: string;
    message: string;
    lines: string[];
}
