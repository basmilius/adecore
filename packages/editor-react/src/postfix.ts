import type { EditorPosition, EditorPostfixOperand, EditorRange } from '@adecore/editor';
import type { CompletionItem } from '@adecore/lsp';
import type { LocalCompletionItem } from './completion.ts';
import { isIdentifierCharacter } from './completion-model.ts';
import { comparePositions } from './diagnostics-model.ts';
import type { EditorLanguage } from './editor-language.ts';
import { lineTextOf, textBeforeOf } from './line-text.ts';
import type { PickRow } from './popups.ts';
import { bodyWithIndentUnit, dedentLines, indentUnitOf, insertSnippet } from './snippet-insert.ts';
import { compileSnippet } from './snippet.ts';
import { SNIPPET_KIND, sortAfterServer, templateContextAt } from './template-context.ts';
import type { PostfixTemplate } from './templates.ts';

const MAX_ROW_LENGTH = 80;

/* The postfix templates that apply to the expressions before one dot. */
interface Candidates {
    readonly dot: EditorPosition;
    readonly operands: readonly EditorPostfixOperand[];
    readonly templates: readonly PostfixTemplate[];
}

/* A key Tab can expand, starting at the dot that leads it. */
interface PostfixKey {
    readonly start: EditorPosition;
    expand(): boolean;
}

/* The identifier characters after the last dot of `before`, and where that dot is; null when no dot leads them. */
function typedKey(before: string): { readonly key: string; readonly dot: number } | null {
    let index = before.length;

    while (index > 0 && isIdentifierCharacter(before[index - 1]!)) {
        index--;
    }

    return index > 0 && before[index - 1] === '.' ? { key: before.slice(index), dot: index - 1 } : null;
}

/* One line of a chooser row: whitespace collapsed and cut short. */
function rowLabel(text: string): string {
    const line = text.replace(/\s+/g, ' ').trim();

    return line.length > MAX_ROW_LENGTH ? `${line.slice(0, MAX_ROW_LENGTH - 1)}…` : line;
}

/*
 * Postfix completion: a dot and a key after an expression, and Tab or an accepted row wraps the expression in a
 * template. The registry holds the templates and `TemplatesFeature` decides whether Tab is ours or a live template's.
 */
export class PostfixFeature {
    private readonly language: EditorLanguage;

    constructor(language: EditorLanguage) {
        this.language = language;
    }

    /* The key before the caret that a template of the registry applies to; null where Tab has no postfix template to expand. */
    key(): PostfixKey | null {
        const { editor, project } = this.language;

        if (!project.templates.settings.postfix) {
            return null;
        }

        const caret = editor.getCaret();
        const typed = typedKey(textBeforeOf(editor, caret));

        if (typed === null || typed.key === '') {
            return null;
        }

        const candidates = this.candidates({ line: caret.line, character: typed.dot }, (template) => template.key === typed.key);

        if (candidates === null) {
            return null;
        }

        return { start: candidates.dot, expand: () => this.expandKey(candidates, caret) };
    }

    /* The rows of the suggestion list after a dot, for the templates whose key the typed characters can lead to. */
    rows(position: EditorPosition): readonly LocalCompletionItem[] {
        const { editor, project } = this.language;
        const { settings } = project.templates;
        const selections = editor.getSelections();

        if (!settings.postfix || !settings.postfixInCompletion || selections.length !== 1 || comparePositions(selections[0]!.start, selections[0]!.end) !== 0) {
            return [];
        }

        const typed = typedKey(textBeforeOf(editor, position));

        if (typed === null) {
            return [];
        }

        const candidates = this.candidates({ line: position.line, character: typed.dot }, (template) => template.key.startsWith(typed.key));

        if (candidates === null) {
            return [];
        }

        const range = { start: { line: position.line, character: typed.dot + 1 }, end: position };

        return candidates.templates.map((template) => this.row(template, candidates, range, sortAfterServer(template.key)));
    }

    private row(template: PostfixTemplate, candidates: Candidates, range: EditorRange, sortText: string): LocalCompletionItem {
        const item: CompletionItem = {
            label: template.key,
            kind: SNIPPET_KIND,
            detail: template.example,
            documentation: template.description,
            filterText: template.key,
            sortText,
            textEdit: { range, newText: template.key }
        };

        return { item, accept: () => this.expand(template, candidates, this.language.editor.getCaret()) };
    }

    /* The templates `matches` lets through that apply to the expressions before `dot`; null when none does. */
    private candidates(dot: EditorPosition, matches: (template: PostfixTemplate) => boolean): Candidates | null {
        const { editor, project } = this.language;
        const operands = editor.postfixOperands?.(dot) ?? [];

        if (operands.length === 0) {
            return null;
        }

        const context = templateContextAt(this.language, dot);

        if (context.place !== 'code') {
            return null;
        }

        const widest = operands.at(-1)!;

        const templates = project.templates.postfix.filter(
            (template) =>
                matches(template) &&
                template.languages.some((family) => context.families.includes(family)) &&
                (template.expression !== 'statement' || widest.statement)
        );

        return templates.length === 0 ? null : { dot, operands, templates };
    }

    /* Expands the one template of a key, or lists them when several share it. */
    private expandKey(candidates: Candidates, caret: EditorPosition): boolean {
        if (candidates.templates.length === 1) {
            this.expand(candidates.templates[0]!, candidates, caret);

            return true;
        }

        const start = { line: candidates.dot.line, character: candidates.dot.character + 1 };

        this.language.completion.showItems(
            candidates.templates.map((template) => this.row(template, candidates, { start, end: caret }, template.id)),
            start
        );

        return true;
    }

    /* Wraps the widest expression for a statement, the only one there is, or the one a person picks from the expressions. */
    private expand(template: PostfixTemplate, candidates: Candidates, caret: EditorPosition): void {
        const { operands } = candidates;

        if (template.expression === 'statement' || operands.length === 1) {
            void this.run(template, template.expression === 'statement' ? operands.at(-1)! : operands[0]!, caret);

            return;
        }

        const { editor, completion, pick, project } = this.language;
        const rows = operands.map((operand, index): PickRow => ({ id: String(index), label: rowLabel(editor.textInRange(operand.range)), detail: '' }));

        completion.close();

        pick.open({
            anchor: caret,
            title: project.i18n.t('editor:language.postfix.expressions'),
            groups: [{ title: null, rows }],
            accept: (id) => void this.run(template, operands[Number(id)]!, caret),
            preview: (id) => Promise.resolve({ removed: [], added: this.rendered(template, operands[Number(id)]!).split('\n'), note: null, kind: 'text' })
        });
    }

    private run(template: PostfixTemplate, operand: EditorPostfixOperand, caret: EditorPosition): Promise<boolean> {
        const { editor } = this.language;
        const expression = this.expressionOf(operand);

        return insertSnippet(
            this.language,
            bodyWithIndentUnit(template.body, indentUnitOf(editor)),
            [{ range: { start: operand.range.start, end: caret } }],
            (name) => (name === 'EXPR' ? expression : undefined)
        );
    }

    /* What the template would put in place of the expression, tab stops at their placeholders. */
    private rendered(template: PostfixTemplate, operand: EditorPostfixOperand): string {
        const expression = this.expressionOf(operand);

        return compileSnippet(bodyWithIndentUnit(template.body, indentUnitOf(this.language.editor))).render(
            (name) => (name === 'EXPR' ? expression : undefined),
            undefined,
            {
                indentVariables: true
            }
        ).text;
    }

    /* The text of an expression, with the indentation of its first line taken off the lines after it. */
    private expressionOf(operand: EditorPostfixOperand): string {
        const { editor } = this.language;
        const indent = /^[\t ]*/.exec(lineTextOf(editor, operand.range.start.line))![0];

        return dedentLines(editor.textInRange(operand.range).trimEnd(), indent);
    }
}
