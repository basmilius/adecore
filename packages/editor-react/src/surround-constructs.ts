import type { CommentSyntax } from '@adecore/editor';
import { escapeSnippetText } from './snippet.ts';
import type { TemplateLanguage } from './templates.ts';

/* A row of Surround With that wraps the selection in a snippet. */
export interface Construct {
    readonly id: string;

    /* Code, so it is not translated. */
    readonly label: string;

    /* Snippet syntax; a tab is one indentation unit. */
    readonly body: string;
}

const SELECTED = '$TM_SELECTED_TEXT';

function block(head: string, tail = ''): string {
    return `${head} {\n\t${SELECTED}\n}${tail}`;
}

const JS_STATEMENTS: readonly Construct[] = [
    { id: 'if', label: 'if', body: block('if ($1)') },
    { id: 'ifElse', label: 'if / else', body: block('if ($1)', ' else {\n\t$2\n}') },
    { id: 'while', label: 'while', body: block('while ($1)') },
    { id: 'doWhile', label: 'do / while', body: `do {\n\t${SELECTED}\n} while ($1);` },
    { id: 'for', label: 'for', body: block('for (let ${1:i} = 0; $1 < $2; $1++)') },
    { id: 'tryCatch', label: 'try / catch', body: block('try', ' catch (${1:e}) {\n\t$0\n}') },
    { id: 'tryFinally', label: 'try / finally', body: block('try', ' finally {\n\t$0\n}') },
    { id: 'tryCatchFinally', label: 'try / catch / finally', body: block('try', ' catch (${1:e}) {\n\t$2\n} finally {\n\t$0\n}') },
    { id: 'braces', label: '{ }', body: `{\n\t${SELECTED}\n}` },
    { id: 'function', label: 'function', body: block('function ${1:name}()') }
];

const PHP_STATEMENTS: readonly Construct[] = [
    JS_STATEMENTS[0]!,
    JS_STATEMENTS[1]!,
    JS_STATEMENTS[2]!,
    JS_STATEMENTS[3]!,
    { id: 'for', label: 'for', body: block('for (\\$${1:i} = 0; \\$$1 < $2; \\$$1++)') },
    { id: 'foreach', label: 'foreach', body: block('foreach (\\$${1:array} as \\$${2:value})') },
    { id: 'tryCatch', label: 'try / catch', body: block('try', ' catch (${1:\\\\Exception} \\$${2:e}) {\n\t$0\n}') },
    JS_STATEMENTS[6]!,
    JS_STATEMENTS[7]!,
    JS_STATEMENTS[9]!
];

const EXPRESSIONS: readonly Construct[] = [
    { id: 'parentheses', label: '(expr)', body: `(${SELECTED})` },
    { id: 'not', label: '!(expr)', body: `!(${SELECTED})` }
];

/* The statement surrounders of the first of the families that has any; JavaScript and TypeScript share theirs. */
export function statementConstructs(families: readonly TemplateLanguage[]): readonly Construct[] {
    if (families.includes('javascript')) {
        return JS_STATEMENTS;
    }

    return families.includes('php') ? PHP_STATEMENTS : [];
}

/* The surrounders of one expression, which JavaScript, TypeScript and PHP share. */
export function expressionConstructs(families: readonly TemplateLanguage[]): readonly Construct[] {
    return families.includes('javascript') || families.includes('php') ? EXPRESSIONS : [];
}

/*
 * The two comment pairs that fold a region, written with the language's own comments: the line comment, or the block
 * pair where there is none. There is no space after the marker, so the output reads `//region Description`.
 */
export function regionConstructs(syntax: CommentSyntax): readonly Construct[] {
    const marker = syntax.line ?? syntax.block?.open;

    if (marker === undefined) {
        return [];
    }

    const start = escapeSnippetText(marker);
    const end = syntax.line === null ? escapeSnippetText(syntax.block?.close ?? '') : '';

    return [
        { id: 'region', label: 'region...endregion', body: `${start}region \${1:Description}${end}\n${SELECTED}\n${start}endregion${end}` },
        { id: 'editorFold', label: '<editor-fold...>', body: `${start}<editor-fold desc="\${1:Description}">${end}\n${SELECTED}\n${start}</editor-fold>${end}` }
    ];
}
