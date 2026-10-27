import type { EditSource } from './edit-source.ts';
import { isBlank, textStart } from './line-text.ts';
import { enclosingBraces, indentGuideAt, visualWidth } from './statements.ts';
import type { Selection } from './types.ts';

export interface CodeBlockOptions {
    tabSize: number;
    /* Whether the guides count as blocks too, which is the only block in a language without braces. */
    guides: boolean;
    /* The offset of the bracket that pairs with the one at an offset. */
    mate(offset: number): number | undefined;
}

function guideTarget(source: EditSource, head: number, edge: 'start' | 'end', options: CodeBlockOptions): number | null {
    const line = source.lineAt(head);
    const info = source.line(line);
    const column = visualWidth(info.text.slice(0, head - info.start), options.tabSize);
    const guide = indentGuideAt(source, line, column, options.tabSize);

    if (guide === null) {
        return null;
    }

    if (edge === 'start') {
        return guide.startLine === line ? null : textStart(source.line(guide.startLine));
    }

    if (guide.endLine >= source.lineCount) {
        return source.line(source.lineCount - 1).end;
    }

    const last = source.line(guide.endLine);

    return isBlank(last.text) ? last.end : textStart(last);
}

function braceTarget(source: EditSource, head: number, edge: 'start' | 'end', options: CodeBlockOptions): number | null {
    if (edge === 'end') {
        if (source.charAt(head) === '{') {
            const mate = options.mate(head);

            if (mate !== undefined && mate > head) {
                return mate + 1;
            }
        }

        for (const brace of enclosingBraces(source, head)) {
            const mate = options.mate(brace);

            // A caret already in front of the closer goes on to the block around it.
            if (mate !== undefined && mate > head) {
                return mate;
            }
        }

        return null;
    }

    if (head > 0 && source.charAt(head - 1) === '}') {
        const mate = options.mate(head - 1);

        if (mate !== undefined && mate < head) {
            return mate;
        }
    }

    for (const brace of enclosingBraces(source, head)) {
        if (brace + 1 < head) {
            return brace + 1;
        }
    }

    return null;
}

/* Where each caret goes for Code Block Start or End; a caret with no block around it stays. The selection extends from its anchor when `extend` is set. */
export function planCodeBlock(
    source: EditSource,
    selections: readonly Selection[],
    edge: 'start' | 'end',
    extend: boolean,
    options: CodeBlockOptions
): Selection[] {
    return selections.map((selection) => {
        const target = (options.guides ? guideTarget(source, selection.head, edge, options) : null) ?? braceTarget(source, selection.head, edge, options);

        if (target === null) {
            return selection;
        }

        return { anchor: extend ? selection.anchor : target, head: target };
    });
}
