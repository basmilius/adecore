import { rangeOf } from './lexical-folds.ts';
import type { DocumentLine } from './rope.ts';
import type { FoldingRange } from './structure.ts';

const MARKDOWN = /^(markdown|md|mdx)$/i;
const HEADING = /^(#{1,6})\s+\S/;
const FENCE = /^\s*(`{3,}|~{3,})/;
const TABLE_ROW = /^\s*\|/;
const HEREDOC = /<<<[ \t]*(["']?)([A-Za-z_]\w*)\1\s*$/;

/*
 * Front matter, code fences, tables and the sections under headings. A fence closes on a line of the same
 * character and at least as long, and what a fence holds is never read as a heading or a table.
 */
function markdownFolds(lineCount: number, getLine: (line: number) => DocumentLine): FoldingRange[] {
    const result: FoldingRange[] = [];
    const headings: { line: number; level: number }[] = [];
    const frontMatter = frontMatterEnd(lineCount, getLine);
    if (frontMatter !== -1) {
        result.push(rangeOf(0, frontMatter, getLine, 'block', 'front-matter'));
    }
    let tableStart = -1;
    const flushTable = (end: number): void => {
        if (tableStart !== -1 && end > tableStart) {
            result.push(rangeOf(tableStart, end, getLine, 'block', 'table'));
        }
        tableStart = -1;
    };
    for (let line = frontMatter + 1; line < lineCount; line++) {
        const text = getLine(line).text;
        const fence = FENCE.exec(text);
        if (fence !== null) {
            flushTable(line - 1);
            const end = fenceEnd(line, fence[1]!, lineCount, getLine);
            if (end !== -1) {
                result.push(rangeOf(line, end, getLine, 'block', 'code-fence'));
                line = end;
            }
            continue;
        }
        if (TABLE_ROW.test(text)) {
            tableStart = tableStart === -1 ? line : tableStart;
            continue;
        }
        flushTable(line - 1);
        const heading = HEADING.exec(text);
        if (heading !== null) {
            headings.push({ line, level: heading[1]!.length });
        }
    }
    flushTable(lineCount - 1);
    for (const [index, heading] of headings.entries()) {
        const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
        let end = (next?.line ?? lineCount) - 1;
        while (end > heading.line && getLine(end).text.trim() === '') {
            end--;
        }
        if (end > heading.line) {
            result.push(rangeOf(heading.line, end, getLine, 'section'));
        }
    }
    return result;
}

/* The line that closes front matter opened on the first line, or -1. */
function frontMatterEnd(lineCount: number, getLine: (line: number) => DocumentLine): number {
    if (lineCount === 0 || getLine(0).text.trim() !== '---') {
        return -1;
    }
    for (let line = 1; line < lineCount; line++) {
        const text = getLine(line).text.trim();
        if (text === '---' || text === '...') {
            return line;
        }
    }
    return -1;
}

/* The line that closes a fence opened on `line` with `marker`, or -1. */
function fenceEnd(line: number, marker: string, lineCount: number, getLine: (line: number) => DocumentLine): number {
    for (let next = line + 1; next < lineCount; next++) {
        const closer = FENCE.exec(getLine(next).text)?.[1];
        if (closer !== undefined && closer[0] === marker[0] && closer.length >= marker.length && getLine(next).text.trim() === closer) {
            return next;
        }
    }
    return -1;
}

/* `<?php ... ?>` blocks that sit between markup, and heredocs and nowdocs. A block that opens the file is the file, not a fold. */
function phpFolds(lineCount: number, getLine: (line: number) => DocumentLine): FoldingRange[] {
    const result: FoldingRange[] = [];
    let open = -1;
    for (let line = 0; line < lineCount; line++) {
        const text = getLine(line).text;
        const heredoc = HEREDOC.exec(text);
        if (heredoc !== null) {
            const closer = new RegExp(`^\\s*${heredoc[2]}\\b`);
            for (let next = line + 1; next < lineCount; next++) {
                if (closer.test(getLine(next).text)) {
                    result.push(rangeOf(line, next, getLine, 'block', 'heredoc'));
                    line = next;
                    break;
                }
            }
            continue;
        }
        const opened = open === -1 ? text.search(/<\?(?:php\b|=)/) : -1;
        const closed = text.indexOf('?>', Math.max(0, opened));
        if (opened !== -1 && closed === -1) {
            open = line === 0 ? -1 : line;
        } else if (open !== -1 && closed !== -1) {
            if (line > open) {
                result.push(rangeOf(open, line, getLine, 'block', 'php-tag'));
            }
            open = -1;
        }
    }
    return result;
}

/* The folds of whole lines that a language has beyond brackets and indentation. */
export function blockFolds(lineCount: number, getLine: (line: number) => DocumentLine, language: string): FoldingRange[] {
    if (MARKDOWN.test(language)) {
        return markdownFolds(lineCount, getLine);
    }
    return language.toLowerCase() === 'php' ? phpFolds(lineCount, getLine) : [];
}
