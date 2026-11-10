import type { TimelineRow } from '../../host/timeline-row';
import { stripAnsi } from './ansi';

/*
 * An answer is markdown on the wire and rendered text on screen, so a copy as text undoes the marks the
 * renderer swallowed. `_` stays: it is a letter in half the identifiers an agent writes (`file_path`).
 */
export function stripMarkdown(text: string): string {
    return text
        .replace(/^ *```[^\n]*\n?/gm, '')
        .replace(/^ *(#{1,6}) +/gm, '')
        .replace(/^ *> ?/gm, '')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
        .replace(/\*(?=\S)([^*\n]*\S)\*/g, '$1')
        .replace(/`+([^`]+)`+/g, '$1')
        .trim();
}

function outputOf(tool: { output: string | null; progress?: { output: string | null } }): string | null {
    const output = tool.output ?? tool.progress?.output ?? null;

    return output === null ? null : stripAnsi(output);
}

export function messageTextOf(row: TimelineRow): string | null {
    switch (row.kind) {
        case 'user':
            return row.item.text || null;
        case 'assistant':
            return stripMarkdown(row.item.text) || null;
        case 'report':
            return stripMarkdown(row.text) || null;
        case 'thinking':
            return row.item.text || null;
        case 'work':
        case 'work-live':
        case 'workflow':
            return outputOf(row.tool);
        case 'work-group': {
            const outputs = row.tools.map(outputOf).filter((output): output is string => output !== null);

            return outputs.length > 0 ? outputs.join('\n\n') : null;
        }
        case 'subagent':
            return row.item.result ?? row.item.summary ?? null;
        case 'note':
            return row.text;
        case 'message':
            return row.message.text || null;
        case 'sent':
            return row.sent.text || null;
        default:
            return null;
    }
}

/* The markdown an answer was written in; every other row has none to copy. */
export function markdownOf(row: TimelineRow): string | null {
    return row.kind === 'assistant' ? row.item.text || null : row.kind === 'report' ? row.text || null : null;
}
