import type { EditorApplyEditsOptions, EditorContentChange, EditorPosition, EditorRange, EditorTextChange, EditorTrackedRange } from '@adecore/editor';
import { abbreviationBefore, expandAbbreviation } from './emmet.ts';
import type { EditorLanguage } from './editor-language.ts';
import { KEY_PRIORITY } from './key-priority.ts';
import { lineTextOf } from './line-text.ts';
import { isVoidElement, markupPlaceAt, markupSyntaxOf, tagPairAt, type MarkupSyntax } from './markup-context.ts';
import { isShortcut } from './shortcut-keys.ts';
import { parseSnippet } from './snippet.ts';
import { indentSnippet } from './snippet-indent.ts';
import { positionInInsertion } from './snippet-session.ts';

/* Each is on unless false. */
export interface MarkupSettings {
    /* Tab after an abbreviation expands it, as Emmet does. */
    readonly emmet?: boolean;
    /* The `>` of a start tag adds its end tag after the caret, and `</` completes the end tag of the open element. */
    readonly closeTags?: boolean;
    /* Changing the name of a start tag changes the name of its end tag with it, and the other way around. */
    readonly linkedTags?: boolean;
}

interface Span {
    readonly from: number;
    readonly to: number;
}

/* The tag name the caret is in and the name of its other tag, as offsets of the current text. */
interface Link {
    readonly own: Span;
    readonly partner: Span;
}

const NAME = /^[\w:.-]*$/;
const NAME_BEFORE = /<\/?[\w:.-]*$/;

/*
 * Writing HTML, XML, the template of a Vue file and the markup of PHP: Emmet abbreviations, end tags that
 * write themselves and tag names that change in pairs. The edits it adds join the undo step of the key that
 * caused them. It does nothing in other languages, in a document over `MAX_MARKUP_SCAN` characters, or with more
 * than one caret.
 */
export class MarkupFeature {
    private readonly language: EditorLanguage;
    private readonly syntax: MarkupSyntax | null;
    private settings: Required<MarkupSettings> = { emmet: true, closeTags: true, linkedTags: true };
    private link: Link | null = null;
    private wrapping: EditorTrackedRange | null = null;
    /* Raised by every change of the text, so a follow-up edit for an older text is dropped. */
    private revision = 0;
    private mirroring = false;

    constructor(language: EditorLanguage) {
        this.language = language;
        this.syntax = markupSyntaxOf(language.languageId);
        if (this.syntax === null) {
            return;
        }
        const { editor } = language;
        const offs = [
            language.onKey((event) => this.key(event), KEY_PRIORITY.markup),
            editor.onTextChange((change) => this.edited(change)),
            editor.onCaret(() => this.moved())
        ];
        language.onDispose(() => {
            this.cancelWrap();
            for (const off of offs) {
                off();
            }
        });
    }

    /* Whether the language of the document is markup this feature writes. */
    get supported(): boolean {
        return this.syntax !== null;
    }

    configure(settings: MarkupSettings): void {
        this.settings = {
            emmet: settings.emmet !== false,
            closeTags: settings.closeTags !== false,
            linkedTags: settings.linkedTags !== false
        };
        if (!this.settings.linkedTags) {
            this.link = null;
        }
    }

    /* Expands the abbreviation before the caret, its places to fill as a snippet; false when there is none, which leaves Tab its own meaning. */
    expand(): boolean {
        const found = this.abbreviation();
        return found !== null && this.insert(found.range, found.expanded, found.line);
    }

    /* Where the abbreviation that `expand` would take starts, without expanding it; null under the conditions where `expand` does nothing. */
    abbreviationAt(): EditorPosition | null {
        return this.abbreviation()?.range.start ?? null;
    }

    private abbreviation(): { range: EditorRange; expanded: string; line: string } | null {
        const { syntax } = this;
        const { editor } = this.language;
        if (syntax === null || !this.settings.emmet || !this.editable()) {
            return null;
        }
        const caret = editor.getCaret();
        const line = lineTextOf(editor, caret.line);
        const found = abbreviationBefore(line, caret.character);
        if (found === null) {
            return null;
        }
        const range = { start: { line: caret.line, character: found.start }, end: { line: caret.line, character: found.end } };
        if (markupPlaceAt(editor.getText(), editor.offsetAt(range.start), syntax)?.kind !== 'text') {
            return null;
        }
        const expanded = expandAbbreviation(found.abbreviation, { syntax, indent: this.indent() });
        return expanded === null ? null : { range, expanded, line };
    }

    /* Opens the field for an abbreviation to wrap the selection in, or the text of the caret's line without one. */
    startWrap(): boolean {
        const { editor, popups } = this.language;
        if (this.syntax === null || !this.editable(true)) {
            return false;
        }
        const range = this.wrapTarget();
        if (range === null) {
            return false;
        }
        this.cancelWrap();
        this.wrapping = editor.trackRange(range);
        popups.setState({ wrap: { anchor: range.start, error: null } });
        return true;
    }

    /* Wraps the text the field was opened over; false, with the reason in the field, when the abbreviation does not expand. */
    submitWrap(abbreviation: string): boolean {
        const { syntax } = this;
        const { editor, popups, project } = this.language;
        const range = this.wrapping?.get() ?? null;
        if (syntax === null || range === null) {
            this.cancelWrap();
            return false;
        }
        const expanded = expandAbbreviation(abbreviation.trim(), { syntax, indent: this.indent(), wrap: this.wrapLines(range) });
        if (expanded === null) {
            popups.setState({ wrap: { anchor: range.start, error: project.i18n.t('editor:language.markup.invalid') } });
            return false;
        }
        this.cancelWrap();
        const inserted = this.insert(range, expanded, lineTextOf(editor, range.start.line));
        editor.focus();
        return inserted;
    }

    cancelWrap(): void {
        this.wrapping?.dispose();
        this.wrapping = null;
        if (this.language.popups.getState().wrap !== null) {
            this.language.popups.setState({ wrap: null });
        }
    }

    private key(event: KeyboardEvent): boolean {
        if (isShortcut(this.language.shortcuts.wrapWithAbbreviation, event)) {
            return this.startWrap();
        }
        if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) {
            return false;
        }
        return this.expand();
    }

    private editable(selection = false): boolean {
        const { editor } = this.language;
        const selections = editor.getSelections();
        if (editor.isReadOnly?.() === true || selections.length !== 1) {
            return false;
        }
        const { start, end } = selections[0]!;
        return selection || (start.line === end.line && start.character === end.character);
    }

    private indent(): string {
        const { tabSize, insertSpaces } = this.language.editor.getIndentation();
        return insertSpaces ? ' '.repeat(tabSize) : '\t';
    }

    /* The selection without the whitespace around it, or the text of the caret's line; null when that is blank. */
    private wrapTarget(): EditorRange | null {
        const { editor } = this.language;
        const selection = editor.getSelection();
        const text = editor.getText();
        const empty = selection.start.line === selection.end.line && selection.start.character === selection.end.character;
        let from = empty ? editor.offsetAt({ line: selection.start.line, character: 0 }) : editor.offsetAt(selection.start);
        let to = empty ? from + lineTextOf(editor, selection.start.line).length : editor.offsetAt(selection.end);
        while (from < to && /\s/.test(text[from]!)) {
            from++;
        }
        while (to > from && /\s/.test(text[to - 1]!)) {
            to--;
        }
        return from === to ? null : { start: editor.positionAt(from), end: editor.positionAt(to) };
    }

    /* The lines of the wrapped text, without the indentation they share, which the expansion gives them again. */
    private wrapLines(range: EditorRange): string[] {
        const lines = this.language.editor.textInRange(range).split(/\r\n|\r|\n/);
        const indents = lines.slice(1).flatMap((line) => (line.trim() === '' ? [] : [/^[\t ]*/.exec(line)![0].length]));
        const shared = indents.length === 0 ? 0 : Math.min(...indents);
        return lines.map((line, index) => (index === 0 ? line : line.slice(Math.min(shared, /^[\t ]*/.exec(line)![0].length))));
    }

    private insert(range: EditorRange, snippet: string, line: string): boolean {
        const { editor, snippets } = this.language;
        const parsed = indentSnippet(parseSnippet(snippet), line);
        if (parsed.limited === true) {
            return false;
        }
        if (!this.apply([{ range, text: parsed.text }])) {
            return false;
        }
        if (parsed.stops.length > 0) {
            snippets.begin(range.start, parsed.text, parsed.stops, parsed.fields);
        } else {
            editor.setCaret(positionInInsertion(range.start, parsed.text, parsed.text.length));
        }
        return true;
    }

    /* Through the snippet session while one runs, so an edit inside its field keeps it going. */
    private apply(changes: readonly EditorContentChange[], options?: EditorApplyEditsOptions): boolean {
        const { editor, snippets } = this.language;
        return snippets.isActive ? snippets.applyEdits(changes, snippets.token, [], options) : editor.applyEdits(changes, options);
    }

    private edited(change: EditorTextChange): void {
        const revision = ++this.revision;
        if (this.mirroring) {
            return;
        }
        const edit = change.changes[0];
        // Backspace and the word deletes are commands too; an undo of both names is two changes and lets go.
        if (change.source === 'external' || change.changes.length !== 1 || edit === undefined || edit.range.start.line !== edit.range.end.line) {
            this.link = null;
            return;
        }
        const from = this.language.editor.offsetAt(edit.range.start);
        const removed = edit.range.end.character - edit.range.start.character;
        this.follow(from, removed, edit.text, revision);
        if (change.source !== 'input' || !this.settings.closeTags || removed !== 0 || this.language.editor.getSelections().length !== 1) {
            return;
        }
        if (edit.text === '>') {
            queueMicrotask(() => this.closeTag(from, revision));
        } else if (edit.text === '/') {
            queueMicrotask(() => this.completeEndTag(from, revision));
        }
    }

    /* Keeps the link on the name being typed and copies the name to its other tag once the edit is in. */
    private follow(from: number, removed: number, inserted: string, revision: number): void {
        const link = this.link;
        if (link === null) {
            return;
        }
        const { own, partner } = link;
        if (from < own.from || from + removed > own.to || !NAME.test(inserted)) {
            this.link = null;
            return;
        }
        const delta = inserted.length - removed;
        this.link = {
            own: { from: own.from, to: own.to + delta },
            partner: partner.from > own.from ? { from: partner.from + delta, to: partner.to + delta } : partner
        };
        queueMicrotask(() => this.mirror(revision));
    }

    private mirror(revision: number): void {
        const link = this.link;
        if (link === null || revision !== this.revision) {
            return;
        }
        const { editor } = this.language;
        const text = editor.getText();
        const name = text.slice(link.own.from, link.own.to);
        if (name === text.slice(link.partner.from, link.partner.to)) {
            return;
        }
        const range = { start: editor.positionAt(link.partner.from), end: editor.positionAt(link.partner.to) };
        this.mirroring = true;
        try {
            if (!this.apply([{ range, text: name }], { mergeUndo: true })) {
                this.link = null;
                return;
            }
        } finally {
            this.mirroring = false;
        }
        const delta = name.length - (link.partner.to - link.partner.from);
        this.link = {
            own: link.partner.from < link.own.from ? { from: link.own.from + delta, to: link.own.to + delta } : link.own,
            partner: { from: link.partner.from, to: link.partner.to + delta }
        };
    }

    /* The `>` at `at` ended a start tag: its end tag goes after it, with the caret between the two. */
    private closeTag(at: number, revision: number): void {
        const { editor } = this.language;
        const text = editor.getText();
        if (revision !== this.revision || text[at] !== '>' || text[at - 1] === '/') {
            return;
        }
        const place = markupPlaceAt(text, at, this.syntax!);
        if (place?.kind !== 'tag' || place.tag.closing || place.tag.inValue || place.tag.name === '' || isVoidElement(place.tag.name, this.syntax!)) {
            return;
        }
        const end = `</${place.tag.name}>`;
        if (text.startsWith(end, at + 1)) {
            return;
        }
        const caret = editor.positionAt(at + 1);
        this.apply([{ range: { start: caret, end: caret }, text: end }], { mergeUndo: true, mapSelections: () => ({ start: caret, end: caret }) });
    }

    /* The `/` at `at` follows a `<` in text: the end tag of the innermost open element is written out. */
    private completeEndTag(at: number, revision: number): void {
        const { editor } = this.language;
        const text = editor.getText();
        if (revision !== this.revision || text[at] !== '/' || text[at - 1] !== '<') {
            return;
        }
        const place = markupPlaceAt(text, at - 1, this.syntax!);
        const element = place?.kind === 'text' ? place.open.at(-1) : undefined;
        if (element === undefined) {
            return;
        }
        const position = editor.positionAt(at + 1);
        const closed = text[at + 1] === '>';
        const completion = closed ? element.name : `${element.name}>`;
        const after = { line: position.line, character: position.character + element.name.length + 1 };
        this.apply([{ range: { start: position, end: position }, text: completion }], { mergeUndo: true, mapSelections: () => ({ start: after, end: after }) });
    }

    /* Links the tag name the caret moved into with its other tag, once the edit that moved it is in. */
    private moved(): void {
        if (!this.settings.linkedTags || this.mirroring) {
            return;
        }
        queueMicrotask(() => {
            this.link = this.linkAtCaret();
        });
    }

    private linkAtCaret(): Link | null {
        const { editor } = this.language;
        if (!this.editable()) {
            return null;
        }
        const caret = editor.getCaret();
        const offset = editor.offsetAt(caret);
        const link = this.link;
        if (link !== null && link.own.from <= offset && offset <= link.own.to) {
            return link;
        }
        const line = lineTextOf(editor, caret.line);
        if (!NAME_BEFORE.test(line.slice(0, caret.character))) {
            return null;
        }
        const pair = tagPairAt(editor.getText(), offset, this.syntax!);
        if (pair === null) {
            return null;
        }
        const inOpen = pair.open.from <= offset && offset <= pair.open.to;
        return inOpen ? { own: pair.open, partner: pair.close } : { own: pair.close, partner: pair.open };
    }
}
