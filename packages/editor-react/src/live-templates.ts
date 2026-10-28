import type { EditorPosition, EditorRange } from '@adecore/editor';
import type { CompletionItem } from '@adecore/lsp';
import type { LocalCompletionItem } from './completion.ts';
import { identifierPrefix, isIdentifierCharacter } from './completion-model.ts';
import { comparePositions } from './diagnostics-model.ts';
import type { EditorLanguage } from './editor-language.ts';
import { KEY_PRIORITY } from './key-priority.ts';
import { textBeforeOf } from './line-text.ts';
import { isShortcut } from './shortcut-keys.ts';
import { bodyWithIndentUnit, dedentLines, insertSnippet, type SnippetPlacement } from './snippet-insert.ts';
import { escapeSnippetText } from './snippet.ts';
import { templateApplies, templateContextAt, type TemplateContext } from './template-context.ts';
import type { LiveTemplate } from './templates.ts';

const TOAST_ID = 'language-templates';
const SNIPPET_KIND = 15;
const IDENTIFIER_START = /[\p{L}_$]/u;

/* The live templates that apply at one caret, and where their key starts. */
interface Match {
    readonly start: EditorPosition;
    readonly templates: readonly LiveTemplate[];
}

/* A key other than a live template's that Tab can expand; `expand` is null where another feature expands it on the same Tab. */
interface CustomKey {
    readonly start: EditorPosition;
    readonly expand: (() => boolean) | null;
}

/* Sorts a completion row after the rows of the same score that a service answers. */
function after(key: string): string {
    return `￿${key}`;
}

/* Sorts the rows of a list of templates by group, then key. */
function grouped(template: LiveTemplate): string {
    return `${template.group ?? template.languages[0]}\u0000${template.key}`;
}

/* A key that starts in the middle of a word is no key, unless it starts with a character no word has. */
function startsInsideWord(before: string, index: number): boolean {
    return index > 0 && IDENTIFIER_START.test(before[index]!) && isIdentifierCharacter(before[index - 1]!);
}

/* The longest start of `key` that the text before the caret ends with, as a number of characters; 0 when none. */
function prefixLength(key: string, before: string): number {
    for (let length = Math.min(key.length, before.length); length >= 1; length--) {
        if (before.endsWith(key.slice(0, length)) && !startsInsideWord(before, before.length - length)) {
            return length;
        }
    }

    return 0;
}

/*
 * Live templates: a key typed before the caret and Tab expands a snippet, Insert Live Template lists the ones that
 * apply, and Save as Live Template hands a selection to the host. The templates come from the registry of the
 * project. Tab comes after a running snippet and before Emmet, and a key that starts before an Emmet abbreviation
 * wins over it, as in IntelliJ.
 */
export class TemplatesFeature {
    private readonly language: EditorLanguage;

    constructor(language: EditorLanguage) {
        this.language = language;

        language.onDispose(
            language.onKey((event) => {
                if (event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing) {
                    return this.expand();
                }

                if (isShortcut(language.shortcuts.insertLiveTemplate, event)) {
                    this.insert();

                    return true;
                }

                if (isShortcut(language.shortcuts.saveAsLiveTemplate, event)) {
                    this.saveSelection();

                    return true;
                }

                return false;
            }, KEY_PRIORITY.templates)
        );

        language.onDispose(language.completion.addSource({ items: (request) => this.rows(request.position) }));
    }

    /*
     * Expands the template whose key ends at the caret, or lists them when several share the key. False where Tab has
     * nothing to expand, and where the key is an Emmet abbreviation, which the markup feature expands on the same Tab.
     */
    expand(): boolean {
        const { editor, completion } = this.language;
        const selections = editor.getSelections();

        if (editor.isReadOnly?.() === true || selections.some((selection) => comparePositions(selection.start, selection.end) !== 0)) {
            return false;
        }

        const match = this.matchAtCarets(selections.map((selection) => selection.start));
        const custom = selections.length === 1 ? this.customKey() : null;

        if (custom !== null && (match === null || comparePositions(match.start, custom.start) >= 0)) {
            return custom.expand?.() ?? false;
        }

        if (match === null) {
            return false;
        }

        if (match.templates.length === 1) {
            this.expandAtCarets(match.templates[0]!, match.start);

            return true;
        }

        completion.showItems(
            match.templates.map((template) =>
                this.row(template, template.key, grouped(template), { start: match.start, end: editor.getCaret() }, () =>
                    this.expandAtCarets(template, match.start)
                )
            ),
            match.start
        );

        return true;
    }

    /* Lists the templates that apply, only the ones whose key or description fits the word before the caret when some do. */
    insert(): void {
        const { editor, completion, project } = this.language;

        if (editor.isReadOnly?.() === true) {
            return;
        }

        const selection = editor.getSelection();
        const selected = comparePositions(selection.start, selection.end) !== 0;
        const caret = editor.getCaret();
        const before = textBeforeOf(editor, caret);
        const word = selected ? '' : identifierPrefix(before);
        const wordStart = { line: caret.line, character: caret.character - word.length };
        const context = templateContextAt(this.language, selected ? selection.start : wordStart);
        const applicable = project.templates.live.filter((template) => templateApplies(template, context));

        if (applicable.length === 0) {
            const title = project.i18n.t('editor:language.templates.none');

            project.host.notify?.({ id: TOAST_ID, kind: 'error', title });
            editor.announce(title);

            return;
        }

        const keyed = (template: LiveTemplate): boolean => word !== '' && prefixLength(template.key, before) > 0;
        const described = (template: LiveTemplate): boolean => word !== '' && (template.description?.toLowerCase().includes(word.toLowerCase()) ?? false);
        const matching = applicable.filter((template) => keyed(template) || described(template));
        const start = matching.length === 0 ? caret : wordStart;
        const text = selected ? editor.textInRange(selection) : '';

        const rows = (matching.length === 0 ? applicable : matching).map((template) =>
            this.row(template, keyed(template) || matching.length === 0 ? template.key : word, grouped(template), { start, end: caret }, () => {
                const range = selected ? selection : { start, end: editor.getCaret() };

                void this.run(template, [{ range, selectedText: selected ? dedentLines(text) : undefined }]);
            })
        );

        completion.showItems(rows, start);
    }

    /* Hands the selection to the host as a draft of a template; false without a selection or without a host that saves. */
    saveSelection(): boolean {
        const { editor, project } = this.language;
        const selection = editor.getSelection();

        if (comparePositions(selection.start, selection.end) === 0) {
            editor.announce(project.i18n.t('editor:language.templates.selectToSave'));

            return false;
        }

        if (project.host.saveAsLiveTemplate === undefined) {
            return false;
        }

        const context = templateContextAt(this.language, selection.start);

        project.host.saveAsLiveTemplate({
            body: escapeSnippetText(dedentLines(editor.textInRange(selection))),
            languages: [context.families[0]!],
            places: [context.place]
        });

        return true;
    }

    /* The keys that compete with a live template for Tab; the postfix key joins Emmet here. */
    private customKey(): CustomKey | null {
        const start = this.language.markup.abbreviationAt();

        return start === null ? null : { start, expand: null };
    }

    /* The templates every caret has the same key of, ending at the caret, in a context they apply in. */
    private matchAtCarets(carets: readonly EditorPosition[]): Match | null {
        const matches = carets.map((caret) => this.matchAt(caret));
        const primary = matches.at(-1);

        if (primary === null || primary === undefined) {
            return null;
        }

        const templates = primary.templates.filter((template) => matches.every((match) => match?.templates.some((other) => other.id === template.id) === true));

        return templates.length === 0 ? null : { start: primary.start, templates };
    }

    /*
     * The templates whose key is the longest one that ends at the caret, as IntelliJ looks them up: when the longest
     * key found applies nowhere, no shorter key is tried.
     */
    private matchAt(caret: EditorPosition): Match | null {
        const { editor, project } = this.language;
        const { live } = project.templates;
        const before = textBeforeOf(editor, caret);
        const longest = live.reduce((length, template) => Math.max(length, template.key.length), 0);

        for (let length = Math.min(longest, before.length); length >= 1; length--) {
            const index = before.length - length;
            const key = before.slice(index);
            const found = live.filter((template) => template.key === key);

            if (found.length === 0 || startsInsideWord(before, index)) {
                continue;
            }

            const start = { line: caret.line, character: index };
            const context = templateContextAt(this.language, start);
            const templates = found.filter((template) => templateApplies(template, context));

            return templates.length === 0 ? null : { start, templates };
        }

        return null;
    }

    /* Replaces the text between `start` and the caret, as far as the primary caret is from it, at every caret. */
    private expandAtCarets(template: LiveTemplate, start: EditorPosition): void {
        const { editor } = this.language;
        const length = Math.max(0, editor.getCaret().character - start.character);

        void this.run(
            template,
            editor.getSelections().map((selection) => ({
                range: { start: { line: selection.end.line, character: Math.max(0, selection.end.character - length) }, end: selection.end }
            }))
        );
    }

    private run(template: LiveTemplate, placements: readonly SnippetPlacement[]): Promise<boolean> {
        const { tabSize, insertSpaces } = this.language.editor.getIndentation();

        return insertSnippet(this.language, bodyWithIndentUnit(template.body, insertSpaces ? ' '.repeat(tabSize) : '\t'), placements);
    }

    /* The rows for the word before the caret, each a template whose key starts with it. */
    private rows(position: EditorPosition): readonly LocalCompletionItem[] {
        const { editor, project } = this.language;

        if (!project.templates.settings.liveInCompletion) {
            return [];
        }

        const before = textBeforeOf(editor, position);

        if (identifierPrefix(before) === '') {
            return [];
        }

        const contexts = new Map<number, TemplateContext>();

        return project.templates.live.flatMap((template) => {
            const length = prefixLength(template.key, before);

            if (length === 0) {
                return [];
            }

            const start = { line: position.line, character: position.character - length };
            const context = contexts.get(length) ?? templateContextAt(this.language, start);

            contexts.set(length, context);

            return templateApplies(template, context)
                ? [this.row(template, template.key, after(template.key), { start, end: position }, () => this.expandAtCarets(template, start))]
                : [];
        });
    }

    private row(template: LiveTemplate, filterText: string, sortText: string, range: EditorRange, accept: () => void): LocalCompletionItem {
        const item: CompletionItem = {
            label: template.key,
            kind: SNIPPET_KIND,
            detail: template.description,
            documentation: { kind: 'markdown', value: `\`\`\`\n${template.body}\n\`\`\`` },
            filterText,
            sortText,
            textEdit: { range, newText: template.key }
        };

        return { item, accept };
    }
}
