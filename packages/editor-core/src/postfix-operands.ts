import type { EditSource } from './edit-source.ts';
import { isPhp, isScript, isWordCharacter } from './lexical.ts';
import { atStatementStart } from './surround-shape.ts';
import { placeAt } from './text-places.ts';
import { skipTriviaBack } from './trivia.ts';
import type { TypingContext } from './typing-context.ts';

export interface PostfixOperand {
    /* The expression is `[from, dot)`, trailing whitespace left out. */
    readonly from: number;
    /* Whether `from` starts a statement; only the widest operand can be true. */
    readonly statement: boolean;
}

type OperatorKind = 'binary' | 'stop' | 'question' | 'colon';

interface Operator {
    readonly kind: OperatorKind;
    readonly precedence: number;
    readonly right: boolean;
}

interface Atom {
    readonly from: number;
    /* The text of a word, a number or a variable. */
    readonly word?: string;
    /* The opening character of a bracket group. */
    readonly group?: string;
}

interface FoundOperator extends Operator {
    readonly start: number;
}

const TERNARY = 2;
const LITERAL_LIMIT = 10_000;
const MAX_OPERATOR_LENGTH = 4;

const binary = (precedence: number, right = false): Operator => ({ kind: 'binary', precedence, right });
const stop: Operator = { kind: 'stop', precedence: 0, right: false };

const SCRIPT_OPERATORS = new Map<string, Operator>([
    ['**', binary(15, true)],
    ['*', binary(14)],
    ['/', binary(14)],
    ['%', binary(14)],
    ['+', binary(13)],
    ['-', binary(13)],
    ['<<', binary(12)],
    ['>>', binary(12)],
    ['>>>', binary(12)],
    ['<', binary(10)],
    ['>', binary(10)],
    ['<=', binary(10)],
    ['>=', binary(10)],
    ['==', binary(9)],
    ['!=', binary(9)],
    ['===', binary(9)],
    ['!==', binary(9)],
    ['&', binary(8)],
    ['^', binary(7)],
    ['|', binary(6)],
    ['&&', binary(5)],
    ['||', binary(4)],
    ['??', binary(3, true)],
    ['?:', binary(TERNARY, true)],
    ['?', { kind: 'question', precedence: TERNARY, right: true }],
    [':', { kind: 'colon', precedence: TERNARY, right: true }]
]);

// An assignment ends the operand, and they are listed so that `>>=` is not read as `>=`.
for (const text of ['=', '=>', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**=', '<<=', '>>=', '>>>=', '&&=', '||=', '??=', '?.', '++', '--', '::']) {
    SCRIPT_OPERATORS.set(text, stop);
}

const PHP_OPERATORS = new Map(SCRIPT_OPERATORS);

PHP_OPERATORS.set('.', binary(11));
PHP_OPERATORS.set('.=', stop);
PHP_OPERATORS.set('<>', binary(10));
PHP_OPERATORS.set('<=>', binary(9));
PHP_OPERATORS.set('->', stop);
PHP_OPERATORS.set('?->', stop);

const SCRIPT_WORDS = new Map<string, Operator>([
    ['in', binary(10)],
    ['instanceof', binary(10)]
]);
const PHP_WORDS = new Map<string, Operator>([
    ['instanceof', binary(10)],
    ['and', binary(1.5)],
    ['xor', binary(1.4)],
    ['or', binary(1.3)]
]);
const UNARY_WORDS = new Set(['typeof', 'void', 'await', 'delete']);
// Words that start a statement or a clause, so they are no operand and nothing to the left of them belongs to an expression.
const KEYWORDS = new Set([
    'return',
    'throw',
    'yield',
    'case',
    'default',
    'const',
    'let',
    'var',
    'echo',
    'print',
    'if',
    'else',
    'elseif',
    'for',
    'foreach',
    'while',
    'do',
    'switch',
    'try',
    'catch',
    'finally',
    'function',
    'class',
    'import',
    'export',
    'of',
    'as',
    'use',
    'new',
    'extends',
    'implements',
    'global',
    'include',
    'require'
]);
const CAST = /^\s*(?:int|integer|bool|boolean|float|double|string|array|object|binary|unset)\s*$/i;

function insideTemplate(context: TypingContext): boolean {
    for (let bracket = context.bracket; bracket !== undefined; bracket = bracket.previous) {
        if (bracket.template === true) {
            return true;
        }
    }

    return false;
}

class Scanner {
    private readonly source: EditSource;
    private readonly php: boolean;
    private readonly typescript: boolean;
    private readonly operators: ReadonlyMap<string, Operator>;
    private readonly words: ReadonlyMap<string, Operator>;

    constructor(source: EditSource, place: string) {
        this.source = source;
        this.php = isPhp(place);
        this.typescript = /^(?:typescript|ts|tsx|typescriptreact|mts|cts)$/i.test(place);
        this.operators = this.php ? PHP_OPERATORS : SCRIPT_OPERATORS;
        this.words = this.php ? PHP_WORDS : SCRIPT_WORDS;
    }

    skip(end: number): number {
        return skipTriviaBack(this.source, end);
    }

    private wordStart(end: number): number {
        let from = end;

        while (from > 0 && isWordCharacter(this.source.charAt(from - 1))) {
            from--;
        }

        return from;
    }

    /* The start of the string, template or regex literal that ends at `end`. */
    private literalStart(end: number): number | null {
        const closing = this.source.context(end - 1);

        if (closing.mode === 'code' && !insideTemplate(closing)) {
            return null;
        }

        for (let at = end - 2; at >= 0 && end - at <= LITERAL_LIMIT; at--) {
            const context = this.source.context(at);

            if (context.mode === 'code' && !insideTemplate(context)) {
                return at;
            }
        }

        return null;
    }

    /* The word, group or literal that ends at `end`. A block, the parenthesis of a control statement and a stray character are none. */
    atom(end: number): Atom | null {
        const { source } = this;

        if (end <= 0) {
            return null;
        }

        const char = source.charAt(end - 1);

        if (isWordCharacter(char)) {
            const from = this.wordStart(end);
            const word = source.slice(from, end);

            if (from > 0 && source.charAt(from - 1) === '/' && source.context(from - 1).mode === 'regex' && /^[a-z]+$/i.test(word)) {
                const start = this.literalStart(from);

                return start === null ? null : { from: start };
            }

            return { from, word };
        }

        if (char === '"' || char === "'" || char === '`' || char === '/') {
            const start = this.literalStart(end);

            return start === null ? null : { from: start };
        }

        if (char === ')' || char === ']' || char === '}') {
            const context = source.context(end - 1);
            const bracket = context.bracket;

            if (context.mode !== 'code' || bracket === undefined || bracket.close !== char || bracket.control === true || bracket.template === true) {
                return null;
            }

            return char === '}' && bracket.block === true ? null : { from: bracket.at, group: source.charAt(bracket.at) };
        }

        return null;
    }

    private reserved(atom: Atom): boolean {
        return atom.word !== undefined && (KEYWORDS.has(atom.word) || UNARY_WORDS.has(atom.word) || this.words.has(atom.word));
    }

    /* An atom with the calls and indexes right behind it, down to its callee. */
    private unit(end: number, property = false): number | null {
        const { source } = this;
        let at = end;

        // The non-null assertion of TypeScript, as long as it is not the start of `!=`.
        while (this.typescript && source.charAt(at - 1) === '!' && source.charAt(at) !== '=' && /[\p{L}\p{N}_$)\]]/u.test(source.charAt(at - 2))) {
            at--;
        }

        let atom = this.atom(at);

        // A keyword is a fine property name.
        if (atom === null || (!property && this.reserved(atom))) {
            return null;
        }

        let start = atom.from;

        while (atom.group === '(' || atom.group === '[') {
            const callee = this.atom(start);

            if (callee === null || this.reserved(callee)) {
                break;
            }

            start = callee.from;
            atom = callee;
        }

        return start;
    }

    /* The length of the member operator that ends at `end`. */
    private member(end: number): number {
        const text = this.source.slice(Math.max(0, end - 3), end);

        if (this.php) {
            if (text.endsWith('?->')) {
                return 3;
            }

            return text.endsWith('->') || text.endsWith('::') ? 2 : Number(text.endsWith('\\'));
        }

        if (text === '...') {
            return 0;
        }

        return text.endsWith('?.') ? 2 : Number(text.endsWith('.'));
    }

    /* The start of the chain of members, calls and indexes that ends at `end`. */
    chain(end: number): number | null {
        const first = this.unit(end);

        if (first === null) {
            return null;
        }

        let start = first;

        for (;;) {
            const before = this.skip(start);
            const length = this.member(before);

            if (length === 0) {
                break;
            }

            // A namespace separator sits between its names without whitespace.
            const separator = this.php && this.source.charAt(before - 1) === '\\';
            const next: number | null = separator && before !== start ? null : this.unit(separator ? before - length : this.skip(before - length), true);

            if (next === null) {
                // A namespace may start with a backslash of its own.
                if (this.source.charAt(before - 1) === '\\') {
                    start = before - 1;
                }

                break;
            }

            start = next;
        }

        const before = this.skip(start);
        const word = this.atom(before)?.word;

        return word === 'new' ? before - 3 : start;
    }

    /* Whether the `.` after the operand is the decimal point of a number. */
    decimalPoint(dot: number): boolean {
        const last = this.atom(dot);

        return !this.php && last?.word !== undefined && /^\d/.test(last.word) && this.source.charAt(last.from - 1) !== '.';
    }

    private operandEnd(end: number): boolean {
        const atom = this.atom(end);

        return atom !== null && !this.reserved(atom);
    }

    /* The start of the prefix operator right before `end`, or -1. */
    private unaryBefore(end: number): number {
        const { source } = this;
        const char = source.charAt(end - 1);

        if (char === '!' || char === '~' || (this.php && char === '@')) {
            return end - 1;
        }

        if (char === '-' || char === '+') {
            const start = source.charAt(end - 2) === char ? end - 2 : end - 1;

            return this.operandEnd(this.skip(start)) ? -1 : start;
        }

        const word = this.atom(end);

        if (word?.word !== undefined) {
            return UNARY_WORDS.has(word.word) ? word.from : -1;
        }

        if (this.php && word?.group === '(' && CAST.test(this.source.slice(word.from + 1, end - 1))) {
            return word.from;
        }

        return -1;
    }

    /* Moves left over the prefix operators of an operand, reporting each start. */
    unaries(start: number, report?: (from: number) => void): number {
        let from = start;

        for (;;) {
            const found = this.unaryBefore(this.skip(from));

            if (found < 0) {
                return from;
            }

            from = found;
            report?.(from);
        }
    }

    operand(end: number): number | null {
        const start = this.chain(end);

        return start === null ? null : this.unaries(start);
    }

    private operatorEndingAt(end: number): { text: string; operator: Operator } | null {
        const word = this.atom(end);

        if (word?.word !== undefined) {
            const operator = this.words.get(word.word);

            return operator === undefined ? null : { text: word.word, operator };
        }

        for (let length = MAX_OPERATOR_LENGTH; length > 0; length--) {
            const text = this.source.slice(Math.max(0, end - length), end);
            const operator = this.operators.get(text);

            if (text.length === length && operator !== undefined) {
                return { text, operator };
            }
        }

        return null;
    }

    /* The binary operator left of an expression that starts at `from`. */
    operatorBefore(from: number): FoundOperator | null {
        const end = this.skip(from);
        const found = end === 0 ? null : this.operatorEndingAt(end);

        if (found === null || (found.operator.kind !== 'binary' && found.operator.kind !== 'colon')) {
            return null;
        }

        return { ...found.operator, start: end - found.text.length };
    }

    /* Whether a line break stands right before `index`, which ends the line of what is left of it. */
    breaksBefore(index: number): boolean {
        return /[\n\r]/.test(this.source.slice(this.skip(index), index));
    }

    /* The `?` that belongs to the `:` at `colon`, past the ternaries nested between them. */
    questionBefore(colon: number): number | null {
        let depth = 0;
        let at = colon;

        for (;;) {
            at = this.skip(at);

            if (at === 0) {
                return null;
            }

            const atom = this.atom(at);

            if (atom !== null) {
                if (atom.word !== undefined && KEYWORDS.has(atom.word)) {
                    return null;
                }

                at = atom.from;

                continue;
            }

            const found = this.operatorEndingAt(at);

            if (found === null || found.operator.kind === 'stop') {
                return null;
            }

            if (found.operator.kind === 'question') {
                if (depth === 0) {
                    return at - 1;
                }

                depth--;
            } else if (found.operator.kind === 'colon') {
                depth++;
            }

            at -= found.text.length;
        }
    }
}

/* Every expression that ends right before the `.` at `dot`, innermost first; empty where none does. */
export function postfixOperands(source: EditSource, dot: number, language: string): PostfixOperand[] {
    if (source.charAt(dot) !== '.') {
        return [];
    }

    const place = placeAt(source, dot, language);

    if (place.kind !== 'code' || !(isScript(place.language) || isPhp(place.language))) {
        return [];
    }

    const scanner = new Scanner(source, place.language);
    const end = scanner.skip(dot);
    const start = end === 0 || scanner.decimalPoint(dot) ? null : scanner.chain(end);

    if (start === null) {
        return [];
    }

    const found = [start];
    const report = (from: number): void => {
        if (from < found.at(-1)!) {
            found.push(from);
        }
    };

    let from = scanner.unaries(start, report);
    let minimum = Infinity;

    for (;;) {
        const operator = scanner.operatorBefore(from);

        if (operator === null) {
            break;
        }

        const operatorStart = operator.kind === 'colon' ? scanner.questionBefore(operator.start) : operator.start;

        // A line has to end in the operator for the expression to go on over it.
        if (operatorStart === null || scanner.breaksBefore(operatorStart)) {
            break;
        }

        const left = scanner.operand(scanner.skip(operatorStart));

        if (left === null) {
            break;
        }

        from = left;
        minimum = Math.min(minimum, operator.precedence);

        // The expression is a subtree only when the operator on its left binds looser than everything inside it.
        const next = scanner.operatorBefore(from);

        if (next === null || scanner.breaksBefore(next.start) || next.precedence < minimum || (next.right && next.precedence <= minimum)) {
            report(from);
        }
    }

    const widest = found.length - 1;

    return found.map((operandFrom, index) => ({ from: operandFrom, statement: index === widest && atStatementStart(source, operandFrom, language) }));
}
