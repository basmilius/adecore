import { safeKey, UiBudget, UiFailure } from './budget.ts';

export type UiValue = null | boolean | number | string | UiValue[] | { [key: string]: UiValue };
export type UiExpression =
    | { kind: 'literal'; value: UiValue }
    | { kind: 'reference'; name: string }
    | { kind: 'array'; items: UiExpression[] }
    | { kind: 'object'; entries: { key: string; value: UiExpression }[] }
    | { kind: 'member'; object: UiExpression; key: UiExpression }
    | { kind: 'unary'; operator: string; value: UiExpression }
    | { kind: 'binary'; operator: string; left: UiExpression; right: UiExpression }
    | { kind: 'call'; name: string; args: UiExpression[] };

interface Token {
    type: 'string' | 'number' | 'name' | 'symbol' | 'end';
    value: string;
}

const PRECEDENCE: Readonly<Record<string, number>> = {
    '||': 1,
    '&&': 2,
    '==': 3,
    '!=': 3,
    '===': 3,
    '!==': 3,
    '<': 4,
    '<=': 4,
    '>': 4,
    '>=': 4,
    '+': 5,
    '-': 5,
    '*': 6,
    '/': 6,
    '%': 6
};
const HELPERS = new Set(['Count', 'Filter', 'Sum', 'Join', 'Round', 'Query', 'Set', 'Reset']);

class ExpressionParser {
    private position = 0;
    private token: Token;
    private readonly source: string;
    private readonly budget: UiBudget;

    constructor(source: string, budget: UiBudget) {
        this.source = source;
        this.budget = budget;
        if (source.length > budget.limits.stringLength) {
            throw new UiFailure('budget_exceeded', 'The expression is too long.');
        }
        this.token = this.read();
    }

    parse(): UiExpression {
        const expression = this.expression(0, 0);
        if (this.token.type !== 'end') {
            throw new UiFailure('invalid_expression', `Unexpected token ${this.token.value}.`);
        }
        return expression;
    }

    private take(value?: string): Token {
        const token = this.token;
        if (value !== undefined && token.value !== value) {
            throw new UiFailure('invalid_expression', `Expected ${value}.`);
        }
        this.token = this.read();
        return token;
    }

    private expression(minimum: number, depth: number): UiExpression {
        this.budget.depth(depth);
        this.budget.node();
        let left = this.primary(depth + 1);
        while (true) {
            const operator = this.token.value;
            const precedence = Object.hasOwn(PRECEDENCE, operator) ? PRECEDENCE[operator] : 0;
            if (precedence === 0 || precedence < minimum) {
                break;
            }
            this.take();
            this.budget.node();
            left = { kind: 'binary', operator, left, right: this.expression(precedence + 1, depth + 1) };
        }
        return left;
    }

    private primary(depth: number): UiExpression {
        const token = this.take();
        let result: UiExpression;
        if (token.type === 'number') {
            const value = Number(token.value);
            if (!Number.isFinite(value)) {
                throw new UiFailure('invalid_expression', 'Numbers must be finite.');
            }
            result = { kind: 'literal', value };
        } else if (token.type === 'string') {
            result = { kind: 'literal', value: token.value };
        } else if (token.value === '!' || token.value === '-' || token.value === '+') {
            result = { kind: 'unary', operator: token.value, value: this.expression(7, depth) };
        } else if (token.value === '(') {
            result = this.expression(0, depth);
            this.take(')');
        } else if (token.value === '[') {
            const items: UiExpression[] = [];
            while (this.token.value !== ']') {
                items.push(this.expression(0, depth));
                if (this.token.value !== ',') {
                    break;
                }
                this.take(',');
            }
            this.take(']');
            result = { kind: 'array', items };
        } else if (token.value === '{') {
            const entries: { key: string; value: UiExpression }[] = [];
            const keys = new Set<string>();
            while (this.token.value !== '}') {
                const key = this.take();
                if (key.type !== 'name' && key.type !== 'string') {
                    throw new UiFailure('invalid_expression', 'Expected an object key.');
                }
                safeKey(key.value);
                if (keys.has(key.value)) {
                    throw new UiFailure('invalid_expression', 'Duplicate object key.');
                }
                keys.add(key.value);
                this.take(':');
                entries.push({ key: key.value, value: this.expression(0, depth) });
                if (this.token.value !== ',') {
                    break;
                }
                this.take(',');
            }
            this.take('}');
            result = { kind: 'object', entries };
        } else if (token.type === 'name' && token.value.startsWith('@')) {
            const name = token.value.slice(1);
            if (!HELPERS.has(name)) {
                throw new UiFailure('refused_call', `Unknown helper @${name}.`);
            }
            this.take('(');
            const args: UiExpression[] = [];
            while (this.token.value !== ')') {
                args.push(this.expression(0, depth));
                if (this.token.value !== ',') {
                    break;
                }
                this.take(',');
            }
            this.take(')');
            result = { kind: 'call', name, args };
        } else if (token.type === 'name' && ['true', 'false', 'null'].includes(token.value)) {
            result = { kind: 'literal', value: token.value === 'null' ? null : token.value === 'true' };
        } else if (token.type === 'name') {
            result = { kind: 'reference', name: safeKey(token.value) };
        } else {
            throw new UiFailure('invalid_expression', `Unexpected token ${token.value}.`);
        }
        while (this.token.value === '.' || this.token.value === '[') {
            this.budget.depth(++depth);
            this.budget.node();
            if (this.take().value === '.') {
                const key = this.take();
                if (key.type !== 'name' || key.value.startsWith('$') || key.value.startsWith('@')) {
                    throw new UiFailure('invalid_expression', 'Expected a field name.');
                }
                result = { kind: 'member', object: result, key: { kind: 'literal', value: safeKey(key.value) } };
            } else {
                const key = this.expression(0, depth);
                this.take(']');
                result = { kind: 'member', object: result, key };
            }
        }
        return result;
    }

    private read(): Token {
        this.budget.step();
        while (/\s/.test(this.source[this.position] ?? '') && this.position < this.source.length) {
            this.position += 1;
            this.budget.step();
        }
        if (this.position === this.source.length) {
            return { type: 'end', value: '' };
        }
        const rest = this.source.slice(this.position);
        const first = rest[0];
        if (first === '"' || first === "'") {
            this.position += 1;
            let value = '';
            let closed = false;
            while (this.position < this.source.length) {
                this.budget.step();
                let character = this.source[this.position++];
                if (character === first) {
                    closed = true;
                    break;
                }
                if (character === '\\') {
                    character = this.source[this.position++];
                    const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '"': '"', "'": "'", '/': '/' };
                    if (character === 'u') {
                        const hex = this.source.slice(this.position, this.position + 4);
                        if (!/^[a-f\d]{4}$/i.test(hex)) {
                            throw new UiFailure('invalid_expression', 'Invalid Unicode escape.');
                        }
                        value += String.fromCharCode(Number.parseInt(hex, 16));
                        this.position += 4;
                    } else if (Object.hasOwn(escapes, character)) {
                        value += escapes[character];
                    } else {
                        throw new UiFailure('invalid_expression', 'Invalid string escape.');
                    }
                } else {
                    value += character;
                }
            }
            if (!closed) {
                throw new UiFailure('incomplete_expression', 'The string is not closed.');
            }
            return { type: 'string', value: this.budget.string(value) };
        }
        const numeric = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
        if (numeric) {
            this.position += numeric[0].length;
            return { type: 'number', value: numeric[0] };
        }
        const name = /^[$@]?[A-Za-z_][A-Za-z_\d]*/.exec(rest);
        if (name) {
            this.position += name[0].length;
            return { type: 'name', value: name[0] };
        }
        const symbol = /^(?:===|!==|==|!=|<=|>=|&&|\|\||[()[\]{},.:!+*/%<>-])/.exec(rest);
        if (symbol) {
            this.position += symbol[0].length;
            return { type: 'symbol', value: symbol[0] };
        }
        throw new UiFailure('invalid_expression', `Unexpected character ${first}.`);
    }
}

export function parseUiExpression(source: string, budget = new UiBudget()): UiExpression {
    return new ExpressionParser(source, budget).parse();
}

export function copyUiValue(value: unknown, budget = new UiBudget(), depth = 0): UiValue {
    budget.depth(depth);
    if (value === null || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        return budget.string(value);
    }
    if (Array.isArray(value)) {
        const result: UiValue[] = [];
        for (let i = 0; i < value.length; i++) {
            budget.iteration();
            const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
            if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
                throw new UiFailure('refused_access', 'Sparse arrays and accessors are refused.');
            }
            result.push(copyUiValue(descriptor.value, budget, depth + 1));
        }
        return result;
    }
    if (typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
        const result: Record<string, UiValue> = Object.create(null);
        for (const key of Object.keys(value)) {
            budget.iteration();
            safeKey(key);
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
                throw new UiFailure('refused_access', 'Accessors are refused.');
            }
            result[key] = copyUiValue(descriptor.value, budget, depth + 1);
        }
        return result;
    }
    throw new UiFailure('invalid_value', 'Only finite JSON values are allowed.');
}

function scalarText(value: UiValue): string {
    if (value !== null && typeof value === 'object') {
        throw new UiFailure('invalid_value', 'Expected a scalar.');
    }
    return value === null ? '' : String(value);
}

function numeric(value: UiValue): number {
    if (typeof value !== 'number') {
        throw new UiFailure('invalid_value', 'Expected a number.');
    }
    return value;
}

function list(value: UiValue): UiValue[] {
    if (!Array.isArray(value)) {
        throw new UiFailure('invalid_value', 'Expected a list.');
    }
    return value;
}

function ownValue(value: UiValue, key: UiValue): UiValue {
    if (typeof key !== 'string' && typeof key !== 'number') {
        throw new UiFailure('refused_access', 'Expected a field name or an index.');
    }
    const name = safeKey(String(key));
    if (value === null || typeof value !== 'object') {
        throw new UiFailure('invalid_value', 'Expected a record or a list.');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
        throw new UiFailure('refused_access', `Unknown own field ${name}.`);
    }
    return descriptor.value;
}

export function evaluateUiExpression(expression: UiExpression, variables: Readonly<Record<string, UiValue>> = {}, budget = new UiBudget()): UiValue {
    // Copy at the boundary so host objects and getters never enter the interpreter.
    const scope = copyUiValue(variables, budget) as Record<string, UiValue>;
    return evaluate(expression, scope, budget, 0);
}

function evaluate(expression: UiExpression, scope: Readonly<Record<string, UiValue>>, budget: UiBudget, depth: number): UiValue {
    budget.depth(depth);
    budget.step();
    const child = (item: UiExpression, nextScope = scope) => evaluate(item, nextScope, budget, depth + 1);
    switch (expression.kind) {
        case 'literal':
            return copyUiValue(expression.value, budget);
        case 'reference':
            return ownValue(scope, expression.name);
        case 'array': {
            const result: UiValue[] = [];
            for (const item of expression.items) {
                budget.iteration();
                result.push(child(item));
            }
            return result;
        }
        case 'object': {
            const result: Record<string, UiValue> = Object.create(null);
            for (const entry of expression.entries) {
                budget.iteration();
                result[safeKey(entry.key)] = child(entry.value);
            }
            return result;
        }
        case 'member':
            return ownValue(child(expression.object), child(expression.key));
        case 'unary': {
            const value = child(expression.value);
            if (expression.operator === '!') {
                return !value;
            }
            if (expression.operator === '-') {
                return -numeric(value);
            }
            if (expression.operator === '+') {
                return numeric(value);
            }
            throw new UiFailure('invalid_expression', 'Unknown unary operator.');
        }
        case 'binary': {
            const left = child(expression.left);
            if (expression.operator === '&&') {
                return left ? child(expression.right) : left;
            }
            if (expression.operator === '||') {
                return left ? left : child(expression.right);
            }
            const right = child(expression.right);
            let result: UiValue;
            switch (expression.operator) {
                case '+':
                    result =
                        typeof left === 'string' || typeof right === 'string'
                            ? budget.string(scalarText(left) + scalarText(right))
                            : numeric(left) + numeric(right);
                    break;
                case '-':
                    result = numeric(left) - numeric(right);
                    break;
                case '*':
                    result = numeric(left) * numeric(right);
                    break;
                case '/':
                    result = numeric(left) / numeric(right);
                    break;
                case '%':
                    result = numeric(left) % numeric(right);
                    break;
                case '==':
                case '===':
                    return left === right;
                case '!=':
                case '!==':
                    return left !== right;
                case '<':
                    return numeric(left) < numeric(right);
                case '<=':
                    return numeric(left) <= numeric(right);
                case '>':
                    return numeric(left) > numeric(right);
                case '>=':
                    return numeric(left) >= numeric(right);
                default:
                    throw new UiFailure('invalid_expression', 'Unknown binary operator.');
            }
            if (typeof result === 'number' && !Number.isFinite(result)) {
                throw new UiFailure('invalid_value', 'The result must be finite.');
            }
            return result;
        }
        case 'call': {
            const args = expression.args;
            const requireArgs = (minimum: number, maximum = minimum) => {
                if (args.length < minimum || args.length > maximum) {
                    throw new UiFailure('invalid_expression', `Invalid arguments for @${expression.name}.`);
                }
            };
            switch (expression.name) {
                case 'Count': {
                    requireArgs(1);
                    const value = child(args[0]);
                    if (typeof value === 'string') {
                        budget.string(value);
                        return value.length;
                    }
                    return list(value).length;
                }
                case 'Filter': {
                    requireArgs(3);
                    const items = list(child(args[0]));
                    const variable = args[1];
                    if (variable.kind !== 'reference' || variable.name.startsWith('$') || variable.name.startsWith('@')) {
                        throw new UiFailure('invalid_expression', '@Filter needs a local name as its second argument.');
                    }
                    safeKey(variable.name);
                    const result: UiValue[] = [];
                    for (const item of items) {
                        budget.iteration();
                        const match = child(args[2], { ...scope, [variable.name]: item });
                        if (typeof match !== 'boolean') {
                            throw new UiFailure('invalid_value', '@Filter needs a boolean predicate.');
                        }
                        if (match) {
                            result.push(item);
                        }
                    }
                    return result;
                }
                case 'Sum': {
                    requireArgs(1, 2);
                    const items = list(child(args[0]));
                    const key = args.length === 2 ? child(args[1]) : null;
                    let total = 0;
                    for (const item of items) {
                        budget.iteration();
                        total += numeric(key === null ? item : ownValue(item, key));
                        if (!Number.isFinite(total)) {
                            throw new UiFailure('invalid_value', 'The sum must be finite.');
                        }
                    }
                    return total;
                }
                case 'Join': {
                    requireArgs(1, 2);
                    const items = list(child(args[0]));
                    const separator = args.length === 2 ? scalarText(child(args[1])) : ', ';
                    let result = '';
                    for (let i = 0; i < items.length; i++) {
                        budget.iteration();
                        result = budget.string(result + (i === 0 ? '' : separator) + scalarText(items[i]));
                    }
                    return result;
                }
                case 'Round': {
                    requireArgs(1, 2);
                    const value = numeric(child(args[0]));
                    const digits = args.length === 2 ? numeric(child(args[1])) : 0;
                    if (!Number.isInteger(digits) || digits < 0 || digits > 6) {
                        throw new UiFailure('invalid_value', 'Precision must be an integer from zero to six.');
                    }
                    const factor = 10 ** digits;
                    const result = Math.round(value * factor) / factor;
                    if (!Number.isFinite(result)) {
                        throw new UiFailure('invalid_value', 'The rounded value must be finite.');
                    }
                    return result;
                }
                case 'Query':
                    throw new UiFailure('query_only', '@Query is only allowed in a read-only variable declaration.');
                case 'Set':
                case 'Reset':
                    throw new UiFailure('action_only', 'State actions are not value expressions.');
                default:
                    throw new UiFailure('refused_call', 'Unknown helper.');
            }
        }
        default:
            throw new UiFailure('invalid_expression', 'Unknown expression.');
    }
}
