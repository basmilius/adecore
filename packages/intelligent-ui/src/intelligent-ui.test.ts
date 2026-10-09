import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { UiBudget } from './budget.ts';
import { compileUi, compileUiBlock } from './compiler.ts';
import { UI_CATALOG, uiCatalogText } from './catalog.ts';
import { copyUiValue, evaluateUiExpression, parseUiExpression } from './expression.ts';
import { evaluateUiBlock, UiState } from './runtime.ts';

function expression(source: string, variables = {}): unknown {
    return evaluateUiExpression(parseUiExpression(source, new UiBudget({ milliseconds: 5000 })), variables, new UiBudget({ milliseconds: 5000 }));
}

function block(source: string, final = true) {
    return compileUiBlock(source, { id: 'chat:item:block', final, limits: { milliseconds: 5000 } });
}

describe('bounded expressions', () => {
    test('arithmetic, strings, own fields and short circuiting', () => {
        expect(expression('1 + 2 * 3')).toBe(7);
        expect(expression('"Fix " + @Count($selected)', { $selected: ['one', 'two'] })).toBe('Fix 2');
        expect(expression('$rows[0].value', { $rows: [{ value: 42 }] })).toBe(42);
        expect(expression('false && $missing')).toBe(false);
        expect(expression('true || $missing')).toBe(true);
        expect(expression('@Round(14.159, 2)')).toBe(14.16);
        expect(expression('@Sum([{value: 2}, {value: 3}], "value")')).toBe(5);
        expect(expression('@Join(["a", "b"], ", ")')).toBe('a, b');
        expect(expression('@Filter($rows, row, row.failed)', { $rows: [{ failed: false }, { failed: true }] })).toEqual([{ failed: true }]);
    });

    test('never calls JavaScript or reads prototypes', () => {
        for (const source of [
            'globalThis',
            'fetch("https://example.com")',
            '$value.toString()',
            '$value["constructor"]',
            '$value.__proto__',
            '@eval("1")',
            '() => 1',
            '{__proto__: {}}',
            '{constructor: 1}',
            '$value.prototype'
        ]) {
            expect(() => expression(source, { $value: {} })).toThrow();
        }
        const object = Object.create({ inherited: 2 });
        expect(() => expression('$value.inherited', { $value: object })).toThrow();
        let called = false;
        const accessor = Object.defineProperty({}, 'secret', {
            enumerable: true,
            get() {
                called = true;
                return 1;
            }
        });
        expect(() => expression('$value.secret', { $value: accessor })).toThrow();
        expect(called).toBe(false);
        expect(() => expression('1 / 0')).toThrow();
        expect(() => expression('@Set($value, 1)', { $value: 0 })).toThrow();
        expect(() => expression('@Query("tasks", {})')).toThrow();
    });

    test('budgets count helper work and bound strings, depth and time', () => {
        const parsed = parseUiExpression('@Sum($items)');
        expect(() => evaluateUiExpression(parsed, { $items: Array(30).fill(1) }, new UiBudget({ iterations: 40 }))).toThrow('iteration budget');
        const joined = parseUiExpression('@Join($items, "abcdefgh")');
        expect(() => evaluateUiExpression(joined, { $items: Array(10).fill('abc') }, new UiBudget({ stringLength: 40 }))).toThrow();
        expect(() => parseUiExpression(`${'('.repeat(40)}1${')'.repeat(40)}`)).toThrow('nesting budget');
        expect(() => parseUiExpression('1 + 2', new UiBudget({ steps: 2 }))).toThrow();
        let time = 0;
        const timed = new UiBudget({ milliseconds: 10 }, () => time++ * 20);
        expect(() => parseUiExpression('1', timed)).toThrow('work budget');
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(() => copyUiValue(circular)).toThrow();
        expect(() => copyUiValue(new Array(1))).toThrow();
    });
});

const EXAMPLES = [
    '<Summary tone="success">Ready to ship</Summary>',
    '$selected = ["links", "preload"]\n$show = false\n<Summary>{@Count($selected)} selected</Summary><Switch value={$show}>Show nits</Switch><Checklist value={$selected}><Item value="links"><File path="src/links.ts" line="148">Fix a path</File></Item><Show when={$show}><Item value="nits">Nits</Item></Show></Checklist><Choices><Choice context={"Fix " + @Join($selected, ", ")}>Fix {@Count($selected)}</Choice></Choices>',
    '<Stats><Stat label="Passed" value={32} previous={29} tone="success"/></Stats><EntityList><Entry label="Owner">Bas</Entry></EntityList>',
    '<Table rows={[{name: "Core", size: 32}]}><Column key="name"/><Column key="size" as="number"/></Table>',
    '<Chart kind="bar" data={[{label: "Core", passed: 32, failed: 1}]}/>',
    '<Tabs><Tab title="First">One</Tab><Tab title="Second">Two</Tab></Tabs><Sections><Section title="Details">Text</Section></Sections>',
    '<CodeBlock language="ts">const markup = "<b>{text}</b>";</CodeBlock><Sources><Source title="Docs" url="https://adecore.dev/"/></Sources>',
    '$count = 4\n$mode = "all"\n<Slider value={$count} min={1} max={16}/><Segmented value={$mode}><Option value="all">All</Option><Option value="failed">Failed</Option></Segmented>',
    '$rows = [{name: "Core"}, {name: "Client"}]\n<EntityList><Each items={$rows} as="row"><Entry label={row.name}>Ready</Entry></Each></EntityList>',
    '<Image generated="latest" alt="A rabbit"/><Steps><Step state="done">Built</Step><Step state="pending">Review</Step></Steps>'
];

describe('streaming compiler', () => {
    test('compiles all catalog examples and evaluates them', () => {
        for (const source of EXAMPLES) {
            const compiled = block(source);
            expect(compiled.diagnostics).toEqual([]);
            const evaluated = evaluateUiBlock(compiled, undefined, { milliseconds: 5000 });
            expect(evaluated.diagnostics).toEqual([]);
            expect(evaluated.nodes.length).toBeGreaterThan(0);
            expect(compiled.fallback).not.toBe('');
        }
        expect(Object.keys(UI_CATALOG)).toHaveLength(35);
        expect(uiCatalogText()).toContain('Image(attachment?, generated?, alt?)');
    });

    test('every prefix is bounded and retains stable nodes after their tag arrives', () => {
        for (const source of EXAMPLES) {
            const complete = block(source);
            const ids = new Set(complete.nodes.map((node) => node.id));
            for (let i = 0; i <= source.length; i++) {
                const partial = block(source.slice(0, i), false);
                expect(partial.diagnostics.some((diagnostic) => diagnostic.code === 'budget_exceeded')).toBe(false);
                for (const node of partial.nodes) {
                    expect(ids.has(node.id)).toBe(true);
                }
            }
        }
    });

    test('finds multiple fences and preserves surrounding text offsets', () => {
        const source = 'Before\n```ruimte-ui\n<Summary>One</Summary>\n```\nBetween\n~~~ruimte-ui\n<Tag>Two</Tag>\n~~~\nAfter';
        const compiled = compileUi(source, { id: 'item', final: true });
        expect(compiled).toHaveLength(2);
        expect(source.slice(compiled[0].start, compiled[0].end)).toStartWith('```ruimte-ui');
        expect(compiled[0].fallback).toBe('One');
        expect(compiled[1].fallback).toBe('Two');
        const otherFence = '````md\n```ruimte-ui\n<Summary>Hidden</Summary>\n```\n````';
        expect(compileUi(otherFence, { id: 'item' })).toEqual([]);
        const partial = compileUi('```ruimte-ui\n<Summary>Still writing', { id: 'item' });
        expect(partial[0].complete).toBe(false);
        expect(partial[0].nodes[0].complete).toBe(false);
    });

    test('isolates unknown tags, refused props and invalid groups', () => {
        const compiled = block(
            '<Unknown>Keep this text</Unknown><Summary style="color:red" tone="success">Valid</Summary><Image url="https://example.com/a.png"/><Choice>Orphan</Choice>'
        );
        expect(compiled.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            'unknown_component',
            'refused_prop',
            'refused_prop',
            'invalid_props',
            'invalid_parent'
        ]);
        expect(compiled.fallback).toContain('Keep this text');
        expect(compiled.nodes[1].props).toEqual({ tone: 'success' });
        const evaluated = evaluateUiBlock(compiled);
        expect(evaluated.nodes[0].error).toBe('unknown_component');
        expect(evaluated.nodes[1].error).toBeUndefined();
        expect(evaluated.nodes[2].error).toBe('invalid_props');
    });

    test('reports malformed final input but keeps neighboring elements', () => {
        const compiled = block('<Summary>One</Summary>\n<Stat value=>\n<Summary>Two</Summary>');
        expect(compiled.diagnostics.length).toBeGreaterThan(0);
        expect(compiled.fallback).toContain('One');
        expect(compiled.fallback).toContain('Two');
        expect(block('<Summary>Unclosed').diagnostics.map((item) => item.code)).toContain('unclosed_tag');
        expect(block('$number = -4\n<Summary>{$number}</Summary>').diagnostics).toEqual([]);
        expect(block('<Callout tone="info" title="Still writ', false).nodes[0].props.title).toBe('Still writ');
        expect(block(EXAMPLES[1]).fallback).toContain('Fix links, preload');
    });

    test('whole-block budgets produce one bounded fallback diagnosis', () => {
        const huge = compileUiBlock('x'.repeat(100), { id: 'item', final: true, limits: { characters: 20 } });
        expect(huge.nodes).toEqual([]);
        expect(huge.fallback).toHaveLength(20);
        expect(huge.diagnostics.map((item) => item.code)).toEqual(['budget_exceeded']);
        const nested = block(`${'<Summary>'.repeat(40)}text${'</Summary>'.repeat(40)}`);
        expect(nested.diagnostics).toHaveLength(1);
        expect(nested.diagnostics[0].code).toBe('budget_exceeded');
        const many = block('<Unknown>text</Unknown>'.repeat(40));
        expect(many.diagnostics.length).toBeLessThanOrEqual(20);
    });

    test('queries only compile against host schemas and are read only', () => {
        const source = '$tasks = @Query("tasks", {limit: 10})\n<Summary>{@Count($tasks)} tasks</Summary>';
        expect(block(source).diagnostics[0].code).toBe('unknown_query');
        const compiled = compileUiBlock(source, { id: 'block', final: true, querySchemas: { tasks: z.strictObject({ limit: z.number().int().max(20) }) } });
        expect(compiled.diagnostics).toEqual([]);
        const state = new UiState(compiled);
        state.setQuery('$tasks', [1, 2], compiled);
        expect(evaluateUiBlock(compiled, state).diagnostics).toEqual([]);
        expect(() => state.run(parseUiExpression('@Set($tasks, [])'))).toThrow();
        expect(() => state.setQuery('$other', [], compiled)).toThrow();
        const changed = { ...compiled, queries: { $tasks: { source: 'tasks', args: { limit: 5 } } } };
        state.sync(changed);
        expect(() => state.setQuery('$tasks', [1, 2], compiled)).toThrow();
        expect(evaluateUiBlock(changed, state).diagnostics[0].code).toBe('refused_access');
    });
});

describe('local state and evaluation', () => {
    test('bindings update dependent text; streaming inputs do not change state', () => {
        const compiled = block('$count = 4\n<Slider value={$count} min={1} max={16}/><Summary>{$count * 2}</Summary>');
        const state = new UiState(compiled);
        const first = evaluateUiBlock(compiled, state);
        first.nodes[0].bindings.value.onValueChange(8);
        const second = evaluateUiBlock(compiled, state);
        expect(second.nodes[1].children[0].props.text).toBe('16');
        second.nodes[0].bindings.value.onValueChange(99);
        expect(state.scope().$count).toBe(8);
        const partial = block('$count = 4\n<Slider value={$count} min={1} max={16}>', false);
        const pendingState = new UiState(partial);
        evaluateUiBlock(partial, pendingState).nodes[0].bindings.value.onValueChange(8);
        expect(pendingState.scope().$count).toBe(4);
    });

    test('preserves edits across recompiles, resets changed defaults and reloads', () => {
        const compiled = block('$count = 4\n<Summary>{$count}</Summary>');
        const state = new UiState(compiled);
        state.run(parseUiExpression('@Set($count, $count + 1)'));
        state.sync(block('$count = 4\n<Summary>{$count} items</Summary>'));
        expect(state.scope().$count).toBe(5);
        state.sync(block('$count = 8\n<Summary>{$count}</Summary>'));
        expect(state.scope().$count).toBe(8);
        expect(new UiState(compiled).scope().$count).toBe(4);
        state.run(parseUiExpression('@Reset()'));
        expect(state.scope().$count).toBe(8);
        state.sync({ ...compiled, id: 'other-block' });
        expect(state.scope().$count).toBe(4);
        expect(() => state.set('$count', 'four')).toThrow();
    });

    test('resolves Show and Each and bounds repeated output before allocation', () => {
        const compiled = block(
            '$rows = [{name: "Core"}, {name: "Client"}]\n<Show when={false}><Summary>Hidden</Summary></Show><Each items={$rows} as="row"><Summary>{row.name}</Summary></Each>'
        );
        const evaluated = evaluateUiBlock(compiled);
        expect(evaluated.nodes.map((node) => node.children[0].props.text)).toEqual(['Core', 'Client']);
        expect(evaluated.nodes[0].id).not.toBe(evaluated.nodes[1].id);
        const exhausted = evaluateUiBlock(compiled, undefined, { iterations: 5 });
        expect(exhausted.diagnostics.some((item) => item.code === 'budget_exceeded')).toBe(true);
        expect(exhausted.nodes).toHaveLength(1);
        expect(exhausted.nodes[0].type).toBe('Each');
        expect(exhausted.nodes[0].error).toBe('budget_exceeded');
        const future = evaluateUiBlock({ ...compiled, catalogVersion: 999 });
        expect(future.nodes[0].error).toBe('unknown_catalog');
    });
});
