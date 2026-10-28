import { SnippetTransformQueueError } from './snippet-transform-queue.ts';
import type { EditorContentChange, EditorPosition, EditorRange } from '@adecore/editor';
import { comparePositions, shiftPosition } from './diagnostics-model.ts';
import type { EditorLanguage } from './editor-language.ts';
import { lineTextOf, textBeforeOf } from './line-text.ts';
import { wordRangeAt } from './rename-model.ts';
import { jobTable } from './snippet-field-transforms.ts';
import { indentSnippet } from './snippet-indent.ts';
import { positionInInsertion } from './snippet-session.ts';
import { SnippetTransformError } from './snippet-transform-client.ts';
import { MAX_TRANSFORM_JOBS, MAX_TRANSFORM_WORK } from './snippet-transform-protocol.ts';
import { compileSnippet, tabOrder, type ParsedSnippet, type SnippetTemplate } from './snippet.ts';
import { createSnippetResolver } from './snippet-variables.ts';
import { fileUriToPath } from '@adecore/lsp';

/* The same limits as an inserted completion item. */
const MAX_CHARACTERS = 2_000_000;
const MAX_RANGES = 1_000;
const TOAST_ID = 'language-completion';

export interface SnippetPlacement {
    readonly range: EditorRange;

    /* The value of `TM_SELECTED_TEXT` at this placement; empty without it. */
    readonly selectedText?: string;
}

class LimitError extends Error {}

interface Draft {
    readonly placement: SnippetPlacement;
    readonly resolve: (name: string) => string | undefined;

    /* As rendered, which is the text the variable transforms read. */
    raw: ParsedSnippet;

    /* Indented to the text before the placement. */
    parsed: ParsedSnippet;
}

/* Each line's leading tabs become the editor's own indentation unit. */
export function bodyWithIndentUnit(body: string, unit: string): string {
    return unit === '\t' ? body : body.replace(/^\t+/gm, (tabs) => unit.repeat(tabs.length));
}

/* The lines after the first without `base` in front of them, or without the shortest indentation among them. */
export function dedentLines(text: string, base?: string): string {
    const lines = text.split(/\r\n|\r|\n/).slice(1);
    const indents = lines.filter((line) => line.trim() !== '').map((line) => /^[\t ]*/.exec(line)![0].length);
    const removed = base?.length ?? (indents.length === 0 ? 0 : Math.min(...indents));

    return removed === 0
        ? text
        : text.replace(
              /(\r\n|\r|\n)([^\r\n]*)/g,
              (_match, lineBreak: string, line: string) => lineBreak + line.slice(Math.min(removed, /^[\t ]*/.exec(line)![0].length))
          );
}

function sizeOf(parsed: ParsedSnippet): number {
    return (
        (parsed.transforms?.length ?? 0) +
        (parsed.fields?.reduce((count, field) => count + field.ranges.length + (field.linked?.length ?? 0), 1) ?? parsed.stops.length)
    );
}

/*
 * Inserts a snippet at every placement, the last of them the primary one, and starts a session on its tab stops. The
 * variables are resolved for each placement (`extra` first, then the host's and the built-in ones), the lines are indented
 * to the text before the placement, and a running session takes the insertion as a nested one. False when nothing was inserted.
 */
export async function insertSnippet(
    language: EditorLanguage,
    source: string,
    placements: readonly SnippetPlacement[],
    extra?: (name: string) => string | undefined
): Promise<boolean> {
    const { editor, project, uri, snippets } = language;

    if (placements.length === 0 || editor.isReadOnly?.() === true) {
        return false;
    }

    const template: SnippetTemplate = compileSnippet(source);
    const now = new Date();
    const token = snippets.token;
    const continuing = snippets.isActive;
    let stale = false;
    const off = editor.onTextChange(() => {
        stale = true;
    });
    const current = (): boolean => !stale && snippets.token === token;

    try {
        let characters = 0;
        let ranges = 0;

        const drafts = placements.map((placement, index): Draft => {
            const line = lineTextOf(editor, placement.range.start.line);
            const word = wordRangeAt(line, placement.range.start);

            const resolver = createSnippetResolver(
                {
                    uri,
                    languageId: language.languageId,
                    position: placement.range.start,
                    selection: placement.range,
                    selectedText: placement.selectedText ?? '',
                    currentLine: line,
                    currentWord: word === null ? '' : editor.textInRange(word),
                    cursorIndex: index,
                    cursorCount: placements.length,
                    folder: project.host.folder,
                    path: fileUriToPath(uri) ?? project.host.pathOfUri?.(uri) ?? undefined
                },
                project.host.resolveSnippetVariable?.bind(project.host),
                { now }
            );

            const resolve = (name: string): string | undefined => extra?.(name) ?? resolver(name);

            const raw = template.render(resolve, undefined, { indentVariables: true });

            return { placement, resolve, raw, parsed: indentSnippet(raw, textBeforeOf(editor, placement.range.start)) };
        });

        for (const { parsed } of drafts) {
            characters += parsed.text.length;
            ranges += sizeOf(parsed);

            if (parsed.limited === true || characters > MAX_CHARACTERS || ranges > MAX_RANGES) {
                throw new LimitError();
            }
        }

        await transformVariables(language, template, drafts, current);

        if (!current()) {
            return false;
        }

        const changes = drafts.map((draft): EditorContentChange => ({ range: draft.placement.range, text: draft.parsed.text }));

        if (changes.reduce((total, change) => total + change.text.length, 0) > MAX_CHARACTERS) {
            throw new LimitError();
        }

        // Insertions before one another move it, so each start is mapped through the changes in front of it.
        const starts = changes.map((change) =>
            changes
                .filter((other) => other !== change && comparePositions(other.range.end, change.range.start) <= 0)
                .sort((left, right) => comparePositions(right.range.start, left.range.start))
                .reduce((place, other) => shiftPosition(place, other), change.range.start)
        );

        if (!(continuing ? snippets.applyEdits(changes, token) : editor.applyEdits(changes))) {
            return false;
        }

        off();
        place(language, drafts, starts, continuing && snippets.isActive && snippets.token === token);
        editor.focus();

        return true;
    } catch (error) {
        if (error instanceof LimitError || (error instanceof SnippetTransformError && error.kind === 'range')) {
            project.host.notify?.({ id: TOAST_ID, kind: 'error', title: project.i18n.t('editor:language.completion.tooLarge') });

            return false;
        }

        if (error instanceof SnippetTransformQueueError) {
            project.host.notify?.({ id: TOAST_ID, kind: 'error', title: project.i18n.t('editor:language.completion.transformBusy') });

            return false;
        }

        if (error instanceof SnippetTransformError) {
            project.host.notify?.({ id: TOAST_ID, kind: 'error', title: project.i18n.t('editor:language.completion.transformFailed') });

            return false;
        }

        throw error;
    } finally {
        off();
    }
}

/* Runs the transforms of variables through the worker, once for all placements, and renders them again with the answers. */
async function transformVariables(language: EditorLanguage, template: SnippetTemplate, drafts: Draft[], current: () => boolean): Promise<void> {
    const { editor, project, snippets } = language;
    const { jobs, slotOf } = jobTable();
    const slots = drafts.map((draft) =>
        (draft.raw.transforms ?? []).map((range) => slotOf({ ...range.transform, value: draft.raw.text.slice(range.start, range.end) }))
    );

    if (jobs.length === 0 || project.host.snippetTransformWorker === undefined) {
        return;
    }

    if (jobs.length > MAX_TRANSFORM_JOBS || jobs.reduce((sum, job) => sum + job.value.length, 0) > MAX_TRANSFORM_WORK) {
        throw new LimitError();
    }

    const values = await snippets.transformVariables(jobs, current);

    if (values === null || !current()) {
        return;
    }

    drafts.forEach((draft, index) => {
        const raw = template.render(
            draft.resolve,
            slots[index]!.map((slot) => values[slot]!),
            { indentVariables: true }
        );

        const parsed = indentSnippet(raw, textBeforeOf(editor, draft.placement.range.start));

        if (parsed.limited === true) {
            throw new LimitError();
        }

        draft.raw = raw;
        draft.parsed = parsed;
    });
}

/* Starts the session on the tab stops, or puts the caret after the primary insertion when there are none. */
function place(language: EditorLanguage, drafts: readonly Draft[], starts: readonly EditorPosition[], nested: boolean): void {
    const { editor, snippets } = language;
    const primary = drafts.at(-1)!.parsed;

    if (primary.stops.length > 0) {
        snippets.beginInstances(
            drafts.map((draft, index) => ({ start: starts[index]!, text: draft.parsed.text, stops: tabOrder(draft.parsed), fields: draft.parsed.fields })),
            { nested }
        );

        return;
    }

    editor.setSelections(
        drafts.map((draft, index) => {
            const end = positionInInsertion(starts[index]!, draft.parsed.text, draft.parsed.text.length);

            return { start: end, end };
        })
    );
}
