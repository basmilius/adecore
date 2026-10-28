import { commentSyntax, type EditorContentChange, type EditorRange } from '@adecore/editor';
import { comparePositions, shiftRange } from './diagnostics-model.ts';
import type { EditorLanguage } from './editor-language.ts';
import { KEY_PRIORITY } from './key-priority.ts';
import { lineTextOf, textBeforeOf } from './line-text.ts';
import { enclosingElements, lineEndOf, lineStartOf, markupSyntaxOf, removeTagEdits, type TextReplacement } from './markup-context.ts';
import type { PickGroup, PickPreview, PickRow } from './popups.ts';
import { isShortcut } from './shortcut-keys.ts';
import { bodyWithIndentUnit, dedentLines, insertSnippet, type SnippetPlacement } from './snippet-insert.ts';
import { indentSnippet } from './snippet-indent.ts';
import { compileSnippet, snippetVariables } from './snippet.ts';
import { expressionConstructs, regionConstructs, statementConstructs } from './surround-constructs.ts';
import { templateApplies, templateContextAt, type TemplateContext } from './template-context.ts';

const TOAST_ID = 'language-surround';
const SELECTED_TEXT = 'TM_SELECTED_TEXT';
const MNEMONICS = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LINE_BREAK = /\r\n|\r|\n/;

/* What Surround With was asked about: the ranges, their language and the shape they share. */
interface Subject {
    readonly placements: readonly SnippetPlacement[];

    /* The language of the ranges, with embedded regions resolved. */
    readonly language: string;
    readonly context: TemplateContext;
    readonly statements: boolean;
    readonly expression: boolean;
}

/* A row of the list and what it does. */
interface Entry {
    readonly row: PickRow;

    /* The snippet it inserts, for the preview; null for a row that inserts none. */
    readonly source: string | null;
    run(): void;
}

/* One thing Unwrap/Remove can do, with the edits in offsets of the current text. */
interface UnwrapRow {
    readonly label: string;

    /* Where the construct starts, which orders the rows. */
    readonly start: number;
    readonly from: number;
    readonly to: number;
    readonly edits: readonly TextReplacement[];
}

/* Where a mnemonic can come from: the first character of a name that no row has taken. */
function mnemonicOf(name: string, taken: Set<string>): string | undefined {
    const found = [...name].find((character) => /[\p{L}\p{N}]/u.test(character) && !taken.has(character.toUpperCase()));

    if (found === undefined) {
        return undefined;
    }

    taken.add(found.toUpperCase());

    return found.toUpperCase();
}

/* Overlapping ranges become one, the one holding the primary range last. Null where two ranges share a line. */
function mergedRanges(ranges: readonly EditorRange[]): EditorRange[] | null {
    const primary = ranges.at(-1)!;
    const sorted = [...ranges].sort((left, right) => comparePositions(left.start, right.start));
    const merged: EditorRange[] = [];

    for (const range of sorted) {
        const last = merged.at(-1);

        if (last !== undefined && comparePositions(range.start, last.end) <= 0) {
            merged[merged.length - 1] = { start: last.start, end: comparePositions(range.end, last.end) > 0 ? range.end : last.end };
        } else {
            merged.push(range);
        }
    }

    if (merged.some((range, index) => index > 0 && range.start.line <= merged[index - 1]!.end.line)) {
        return null;
    }

    const index = merged.findIndex((range) => comparePositions(range.start, primary.start) <= 0 && comparePositions(primary.start, range.end) <= 0);

    return [...merged.filter((_range, other) => other !== index), merged[index]!];
}

/*
 * Surround With, Surround with Live Template and Unwrap/Remove, as IntelliJ's handlers offer them. Surround With
 * wraps the selection, or the content of the caret's line, in a statement, an expression, a region comment or a live
 * template that uses the selected text; Unwrap/Remove takes the construct around the caret away and keeps what is in it.
 * Each is one edit, so one undo step, and nothing happens in a read-only editor.
 */
export class SurroundFeature {
    private readonly language: EditorLanguage;

    constructor(language: EditorLanguage) {
        this.language = language;

        language.onDispose(
            language.onKey((event) => {
                if (isShortcut(language.shortcuts.surroundWith, event)) {
                    return this.open();
                }

                if (isShortcut(language.shortcuts.surroundWithLiveTemplate, event)) {
                    return this.openTemplates();
                }

                return isShortcut(language.shortcuts.unwrap, event) && this.unwrap();
            }, KEY_PRIORITY.templates)
        );
    }

    /* Opens Surround With under the selection. True, since the chord is taken, also where nothing applies. */
    open(): boolean {
        return this.show(false);
    }

    /* Opens Surround with Live Template: Emmet in markup, then the templates that use the selected text. */
    openTemplates(): boolean {
        return this.show(true);
    }

    /* Opens the list of constructs around the caret that can be unwrapped or removed. */
    unwrap(): boolean {
        const { editor, pick, project } = this.language;

        if (editor.isReadOnly?.() === true) {
            return true;
        }

        const rows = this.unwrapRows();

        if (rows.length === 0) {
            return true;
        }

        const text = editor.getText();

        pick.open({
            anchor: editor.getCaret(),
            title: project.i18n.t('editor:language.surround.unwrap.title'),
            groups: [{ title: null, rows: rows.map((row, index) => ({ id: String(index), label: row.label, detail: '' })) }],
            filter: true,
            accept: (id) => this.applyUnwrap(rows[Number(id)]!),
            preview: (id) => Promise.resolve(this.unwrapPreview(text, rows[Number(id)]!))
        });

        return true;
    }

    private show(templatesOnly: boolean): boolean {
        const { editor, pick, project } = this.language;

        if (editor.isReadOnly?.() === true) {
            return true;
        }

        const subject = this.subjectOf();

        if (subject === null) {
            this.refuse('editor:language.surround.none');

            return true;
        }

        const groups = this.groupsOf(subject, templatesOnly);
        const entries = new Map(groups.flatMap((group) => group.entries).map((entry) => [entry.row.id, entry]));

        if (entries.size === 0) {
            this.refuse(templatesOnly ? 'editor:language.surround.noTemplates' : 'editor:language.surround.none');

            return true;
        }

        const primary = subject.placements.at(-1)!;

        pick.open({
            anchor: primary.range.start,
            title: project.i18n.t(templatesOnly ? 'editor:language.surround.selectTemplate' : 'editor:language.surround.title'),
            groups: groups.map((group): PickGroup => ({ title: group.title, rows: group.entries.map((entry) => entry.row) })),
            accept: (id) => entries.get(id)!.run(),
            preview: (id) => Promise.resolve(this.previewOf(entries.get(id)!.source, primary))
        });

        return true;
    }

    private refuse(key: string): void {
        const { editor, project } = this.language;
        const title = project.i18n.t(key);

        project.host.notify?.({ id: TOAST_ID, kind: 'error', title });
        editor.announce(title);
    }

    /* The ranges to surround, their language and what they can be surrounded with; null where nothing can be. */
    private subjectOf(): Subject | null {
        const { editor, languageId } = this.language;
        const candidates = editor.getSelections().flatMap((selection): EditorRange[] => {
            if (comparePositions(selection.start, selection.end) !== 0) {
                return [selection];
            }

            const line = lineTextOf(editor, selection.start.line);
            const content = line.trim();

            if (content === '') {
                return [];
            }

            const start = line.length - line.trimStart().length;

            return [{ start: { line: selection.start.line, character: start }, end: { line: selection.start.line, character: start + content.length } }];
        });

        const ranges = candidates.length === 0 ? null : mergedRanges(candidates);
        const found = ranges?.map((range) => editor.surroundShape?.(range) ?? null) ?? [];
        const shapes = found.filter((shape) => shape !== null);

        if (shapes.length === 0 || shapes.length !== found.length) {
            return null;
        }

        const languages = shapes.flatMap((shape) => [shape.range.start, shape.range.end]).map((position) => editor.placeAt?.(position)?.language ?? languageId);

        if (new Set(languages).size !== 1) {
            return null;
        }

        return {
            placements: shapes.map((shape) => ({ range: shape.range, selectedText: dedentLines(editor.textInRange(shape.range)) })),
            language: languages[0]!,
            context: templateContextAt(this.language, shapes.at(-1)!.range.start),
            statements: shapes.every((shape) => shape.statements),
            expression: shapes.every((shape) => shape.expression)
        };
    }

    private groupsOf(subject: Subject, templatesOnly: boolean): Array<{ title: string | null; entries: Entry[] }> {
        const { project } = this.language;
        const { families } = subject.context;
        const taken = new Set<string>();
        let next = 0;

        const numbered = (): string | undefined => {
            const mnemonic = MNEMONICS[next++];

            if (mnemonic !== undefined) {
                taken.add(mnemonic);
            }

            return mnemonic;
        };

        const insert = (id: string, label: string, detail: string, source: string, mnemonic: string | undefined): Entry => ({
            row: { id, label, detail, mnemonic },
            source,
            run: () => this.insert(source, subject.placements)
        });

        const own: Entry[] = [];

        if (!templatesOnly) {
            const constructs = [
                ...(subject.statements ? statementConstructs(families) : []),
                ...(subject.expression ? expressionConstructs(families) : []),
                ...regionConstructs(commentSyntax(subject.language))
            ];

            for (const construct of constructs) {
                const region = construct.id === 'region' || construct.id === 'editorFold';
                const label = region ? project.i18n.t('editor:language.surround.comments', { construct: construct.label }) : construct.label;

                own.push(insert(`construct:${construct.id}`, label, '', construct.body, numbered()));
            }
        }

        const live: Entry[] = [];
        const markup = this.language.markup;

        if (markup.supported && (families.includes('html') || families.includes('xml')) && this.language.editor.getSelections().length === 1) {
            live.push({
                row: { id: 'emmet', label: 'Emmet', detail: '', mnemonic: mnemonicOf('Emmet', taken) },
                source: null,
                run: () => {
                    this.language.editor.setSelection(subject.placements[0]!.range);
                    markup.startWrap();
                }
            });
        }

        for (const template of project.templates.live) {
            if (snippetVariables(template.body).has(SELECTED_TEXT) && templateApplies(template, subject.context)) {
                live.push(insert(`template:${template.id}`, template.key, template.description ?? '', template.body, mnemonicOf(template.key, taken)));
            }
        }

        const configure = project.host.openTemplateSettings?.bind(project.host);

        if (configure !== undefined) {
            live.push({
                row: { id: 'configure', label: project.i18n.t('editor:language.surround.configure'), detail: '' },
                source: null,
                run: () => configure()
            });
        }

        if (templatesOnly) {
            return [{ title: null, entries: live }];
        }

        return [
            { title: null, entries: own },
            { title: project.i18n.t('editor:language.surround.liveTemplates'), entries: live }
        ].filter((group) => group.entries.length > 0);
    }

    /* Inserts the snippet around every range; a snippet that still runs ends first, as the previous template does in IntelliJ. */
    private insert(source: string, placements: readonly SnippetPlacement[]): void {
        this.language.snippets.end();
        void insertSnippet(this.language, bodyWithIndentUnit(source, this.indentUnit()), placements);
    }

    private indentUnit(): string {
        const { tabSize, insertSpaces } = this.language.editor.getIndentation();

        return insertSpaces ? ' '.repeat(tabSize) : '\t';
    }

    /* The lines the primary range covers, and the same lines with the snippet in the range's place. */
    private previewOf(source: string | null, placement: SnippetPlacement): PickPreview | null {
        const { editor } = this.language;

        if (source === null) {
            return null;
        }

        const { range } = placement;
        const before = textBeforeOf(editor, range.start);
        const rendered = compileSnippet(bodyWithIndentUnit(source, this.indentUnit())).render(
            (name) => (name === SELECTED_TEXT ? (placement.selectedText ?? '') : undefined),
            undefined,
            { indentVariables: true }
        );

        const after = lineTextOf(editor, range.end.line).slice(range.end.character);

        return {
            removed: editor
                .textInRange({
                    start: { line: range.start.line, character: 0 },
                    end: { line: range.end.line, character: lineTextOf(editor, range.end.line).length }
                })
                .split(LINE_BREAK),
            added: (before + indentSnippet(rendered, before).text + after).split(LINE_BREAK),
            note: null
        };
    }

    private unwrapRows(): UnwrapRow[] {
        const { editor, languageId, project } = this.language;
        const unit = this.indentUnit();
        const caret = editor.getCaret();
        const text = editor.getText();
        const syntax = markupSyntaxOf(languageId);

        const scripts = (editor.unwrapTargets?.(caret) ?? []).map((target): UnwrapRow => {
            const from = editor.offsetAt(target.range.start);

            return {
                label: project.i18n.t(`editor:language.surround.unwrap.${target.kind}`),
                start: from,
                from,
                to: editor.offsetAt(target.range.end),
                edits: target.edits
                    .map((edit) => ({ from: editor.offsetAt(edit.range.start), to: editor.offsetAt(edit.range.end), text: edit.text }))
                    .sort((left, right) => left.from - right.from)
            };
        });

        const tags =
            syntax === null
                ? []
                : enclosingElements(text, editor.offsetAt(caret), syntax).map((element): UnwrapRow => ({
                      label: project.i18n.t('editor:language.surround.unwrap.tag', { name: element.name }),
                      start: element.open.from,
                      from: element.open.from,
                      to: element.close?.to ?? element.open.to,
                      edits: removeTagEdits(text, element, unit)
                  }));

        // The sort is stable, so the rows of one construct stay in the order the editor gave them.
        return [...scripts, ...tags].sort((left, right) => right.start - left.start);
    }

    private applyUnwrap(row: UnwrapRow): void {
        const { editor } = this.language;
        const changes = row.edits.map((edit): EditorContentChange => ({
            range: { start: editor.positionAt(edit.from), end: editor.positionAt(edit.to) },
            text: edit.text
        }));
        const descending = [...changes].reverse();

        editor.applyEdits(changes, { mapSelections: (range) => shiftRange(range, descending) });
        editor.focus();
    }

    /* The lines of the construct before and after its edits. */
    private unwrapPreview(text: string, row: UnwrapRow): PickPreview {
        const edits = row.edits;
        const from = lineStartOf(text, Math.min(row.from, ...edits.map((edit) => edit.from)));
        let last = Math.max(row.to, ...edits.map((edit) => edit.to));

        // An edit that takes a line break with it ends at the start of the next line, which is not part of the preview.
        while (last > from && /[\r\n]/.test(text[last - 1]!)) {
            last--;
        }

        const to = lineEndOf(text, last);

        const after = [...edits]
            .reverse()
            .reduce((result, edit) => result.slice(0, edit.from - from) + edit.text + result.slice(edit.to - from), text.slice(from, to));

        return { removed: text.slice(from, to).split(LINE_BREAK), added: after === '' ? [] : after.split(LINE_BREAK), note: null };
    }
}
