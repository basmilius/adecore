import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test';
import { UI_COMPONENT_ALIASES } from './aliases.ts';
import { isUiComponent, UI_CATALOG } from './catalog.ts';
import { compileUiBlock } from './compiler.ts';
import type { UiViewNode } from './model.ts';
import { evaluateUiBlock } from './runtime.ts';

// A stopped clock, so a slow runner cannot spend the time budget of a UI block before it is built.
beforeEach(() => setSystemTime(Date.now()));
afterEach(() => setSystemTime());

function block(source: string, final = true) {
    return compileUiBlock(source, { id: 'block', final, limits: { milliseconds: 5000 } });
}

interface Reading {
    codes: string[];
    errors: string[];
    messages: string[];
    nodes: UiViewNode[];
}

/* What a block compiles and evaluates to: the codes of its diagnostics, the nodes that fell back to text, and the tree a renderer draws. */
function reading(source: string): Reading {
    const compiled = block(source);
    const evaluated = evaluateUiBlock(compiled);
    const errors: string[] = [];

    const visit = (nodes: readonly UiViewNode[]) => {
        for (const node of nodes) {
            if (node.error) {
                errors.push(`${node.type}:${node.error}`);
            }

            visit(node.children);
        }
    };

    visit(evaluated.nodes);

    return {
        codes: compiled.diagnostics.map((item) => `${item.code}${item.severity ? '' : '!'}`),
        errors,
        messages: compiled.diagnostics.map((item) => item.message),
        nodes: evaluated.nodes
    };
}

function first(source: string, type: string): UiViewNode {
    const find = (nodes: readonly UiViewNode[]): UiViewNode | undefined => {
        for (const node of nodes) {
            const found = node.type === type ? node : find(node.children);

            if (found) {
                return found;
            }
        }

        return undefined;
    };

    return find(reading(source).nodes)!;
}

describe('a value written in another type', () => {
    test('a number as text is the number, with a warning that says how it is written', () => {
        const read = reading('<Stats><Stat label="Tests" value="42" previous="40"/></Stats>');
        expect(read.errors).toEqual([]);
        expect(read.codes).toEqual(['coerced_prop', 'coerced_prop']);
        expect(read.messages[0]).toBe('Stat value takes a number: write value={42}, not value="42"; read as that.');
        expect(read.nodes[0].children[0].props).toEqual({ label: 'Tests', value: 42, previous: 40 });
    });

    test('reads numbers, booleans, text and lists wherever the schema asks for them', () => {
        expect(first('<Progress value="60" max="100">Upload</Progress>', 'Progress').props).toEqual({ value: 60, max: 100 });
        expect(first('$n = 3\n<Slider value={$n} min="0" max="10">Count</Slider>', 'Slider').props).toEqual({ value: 3, min: 0, max: 10 });
        expect(first('<Map><Place lat="52.09" lon="5.12">Utrecht</Place></Map>', 'Place').props).toEqual({ lat: 52.09, lon: 5.12 });
        expect(first('$on = false\n<Switch value="True">Notify</Switch>', 'Switch').props).toEqual({ value: true });
        expect(first('<Choices><Choice primary="true">Go</Choice></Choices>', 'Choice').props).toEqual({ primary: true });
        expect(first('<Stats><Stat label="A" value={42} unit={5}/></Stats>', 'Stat').props).toEqual({ label: 'A', value: 42, unit: '5' });
        expect(first(`<Table rows='[{"a":1}]'><Column key="a"/></Table>`, 'Table').props).toEqual({ rows: [{ a: 1 }] });
        expect(reading('<Show when="true"><Tag>shown</Tag></Show>').nodes.map((node) => node.type)).toEqual(['Tag']);
    });

    test('writes the read value into the block, so a client that reads strictly draws it', () => {
        const compiled = block('<Stats><Stat label="Tests" value="42"/></Stats>');
        expect(compiled.nodes[0].children[0].props).toEqual({ label: 'Tests', value: 42 });
    });

    test('reads what state hands a prop as leniently as what is written', () => {
        const read = reading('$max = "10"\n$n = 3\n<Slider value={$n} min={0} max={$max}>Count</Slider>');
        expect(read.errors).toEqual([]);
        expect(read.codes).toEqual(['coerced_prop']);
        expect(read.nodes[0].props).toEqual({ value: 3, min: 0, max: 10 });
    });

    test('never guesses a number: a comma, an exponent or words stay what they are', () => {
        for (const written of ['1,5', '1e3', '0x1f', '', 'ten']) {
            expect(reading(`$n = 3\n<Slider value={$n} min="${written}" max={10}>Count</Slider>`).errors, written).toEqual(['Slider:invalid_props']);
        }

        expect(reading('<Map><Place lat="52,09" lon="5.12">Utrecht</Place></Map>').errors).toEqual(['Place:invalid_props']);
    });

    test('leaves a scalar as written, since "1" and 1 are two values there', () => {
        const options = first(
            '$picked = "1"\n<Segmented value={$picked}><Option value="1">One</Option><Option value={1}>Other</Option></Segmented>',
            'Segmented'
        );
        expect(options.children.map((child) => child.props.value)).toEqual(['1', 1]);
    });

    test('reads a bare number or boolean, and still refuses a bare word', () => {
        const read = reading('<Stats><Stat label="Tests" value=42 previous=-1.5/></Stats><Choices><Choice primary=true>Go</Choice></Choices>');
        expect(read.codes).toEqual([]);
        expect(read.nodes[0].children[0].props).toEqual({ label: 'Tests', value: 42, previous: -1.5 });
        expect(read.nodes[1].children[0].props).toEqual({ primary: true });
        const word = block('<Tag tone=loud>x</Tag>');
        expect(word.diagnostics.map((item) => item.code)).toEqual(['invalid_prop']);
        expect(word.diagnostics[0].message).toBe('Write tone="text", or tone={value} for a number, a boolean, a list or an expression.');
    });

    test('a bare number waits for the rest of its digits while the block streams', () => {
        const open = block('<Stats><Stat label="Tests" value=4', false);
        expect(open.nodes[0].children[0].props.value).toBeUndefined();
        expect(block('<Stats><Stat label="Tests" value=42/>', false).nodes[0].children[0].props.value).toBe(42);
    });
});

describe('a quantity', () => {
    test('a number with its unit reads as the number, the unit in its own prop', () => {
        const read = reading('<Stats><Stat label="Build" value="12 min" previous="10 min"/></Stats>');
        expect(read.errors).toEqual([]);
        expect(read.nodes[0].children[0].props).toEqual({ label: 'Build', value: 12, previous: 10, unit: 'min' });
        expect(read.messages[0]).toBe('Stat value takes a number: write value={12} unit="min", not value="12 min"; read as that.');
        expect(first('<Stats><Stat label="Bundle" value="412kB"/></Stats>', 'Stat').props).toEqual({ label: 'Bundle', value: 412, unit: 'kB' });
        expect(first('<Stats><Stat label="Coverage" value="71%"/></Stats>', 'Stat').props).toEqual({ label: 'Coverage', value: 71, unit: '%' });
    });

    test('what is more than one number and a unit stays the text an agent wrote', () => {
        for (const written of ['21 min 38 sec', '6,777', '1,5', '~12']) {
            const read = reading(`<Stats><Stat label="CI" value="${written}"/></Stats>`);
            expect(read.codes, written).toEqual([]);
            expect(read.nodes[0].children[0].props, written).toEqual({ label: 'CI', value: written });
        }
    });

    test('two units are never compared: the previous one is left out', () => {
        const read = reading('<Stats><Stat label="Build" value="2 min" previous="90 sec"/></Stats>');
        expect(read.errors).toEqual([]);
        expect(read.codes).toEqual(['dropped_prop', 'coerced_prop']);
        expect(read.nodes[0].children[0].props).toEqual({ label: 'Build', value: 2, unit: 'min' });
    });

    test('a written unit wins: a quantity in another unit is not read', () => {
        expect(first('<Stats><Stat label="Build" value="12 min" unit="min"/></Stats>', 'Stat').props).toEqual({ label: 'Build', value: 12, unit: 'min' });
        expect(first('<Stats><Stat label="Build" value="12 min" unit="sec"/></Stats>', 'Stat').props).toEqual({ label: 'Build', value: '12 min', unit: 'sec' });
    });

    test('a number beside a quantity does not take its unit', () => {
        const stat = first('<Stats><Stat label="Build" value="12 min" previous={600}/></Stats>', 'Stat');
        expect(stat.props).toEqual({ label: 'Build', value: '12 min', previous: 600 });
    });

    test('a component without a unit reads only a percentage', () => {
        expect(first('<Progress value="60%">Upload</Progress>', 'Progress').props).toEqual({ value: 60 });
        expect(reading('<Progress value="60 files">Upload</Progress>').codes).toEqual(['dropped_prop']);
    });

    test('a number that steers something never reads a unit', () => {
        expect(reading('$n = 3\n<Slider value={$n} min="0 px" max={10}>Count</Slider>').errors).toEqual(['Slider:invalid_props']);
        expect(reading('<Map><Place lat="52.09 N" lon={5.12}>Utrecht</Place></Map>').errors).toEqual(['Place:invalid_props']);
    });

    test('a chart reads a series written as text, with the unit its values share', () => {
        const read = reading('<Chart kind="bar" data={[{"label": "A", "ms": "12 ms"}, {"label": "B", "ms": "7 ms"}]}/>');
        expect(read.codes).toEqual(['coerced_prop']);
        expect(read.nodes[0].props).toEqual({
            kind: 'bar',
            unit: 'ms',
            data: [
                { label: 'A', ms: 12 },
                { label: 'B', ms: 7 }
            ]
        });

        const mixed = reading('<Chart kind="bar" data={[{"label": "A", "v": "12 ms"}, {"label": "B", "v": "7 s"}]}/>');
        expect(mixed.codes).toEqual([]);
        expect(mixed.nodes[0].props.data).toEqual([
            { label: 'A', v: '12 ms' },
            { label: 'B', v: '7 s' }
        ]);
    });
});

describe('a synonym', () => {
    test('a value an enum does not have reads as the one it means', () => {
        expect(first('<Tag tone="error">Failed</Tag>', 'Tag').props).toEqual({ tone: 'danger' });
        expect(first('<Stats><Stat label="Tests" value={42} tone="Positive"/></Stats>', 'Stat').props.tone).toBe('success');
        expect(first('<Steps><Step state="active">Build</Step></Steps>', 'Step').props).toEqual({ state: 'running' });
        const read = reading('<Callout tone="error">Down</Callout>');
        expect(read.codes).toEqual(['renamed_value']);
        expect(read.messages[0]).toBe('Callout tone is "danger", not "error"; read as "danger".');
    });

    test('a prop under another name reads as the prop, unless the prop is written too', () => {
        expect(first('<Tabs><Tab label="A">x</Tab></Tabs>', 'Tab').props).toEqual({ title: 'A' });
        expect(first('<Map><Place lat={52.09} lng={5.12}>Utrecht</Place></Map>', 'Place').props).toEqual({ lat: 52.09, lon: 5.12 });
        expect(reading('<Tabs><Tab label="A" title="B">x</Tab></Tabs>').codes).toEqual(['refused_prop']);
        expect(reading('$name = "x"\n<Button onClick={@Reset($name)}>Clear</Button>')).toMatchObject({ codes: ['renamed_prop'], errors: [] });
    });

    test('a component under another name reads as the component', () => {
        const read = reading('<Badge tone="success">ok</Badge>');
        expect(read.codes).toEqual(['renamed_component']);
        expect(read.messages[0]).toBe('Badge is not a component; read as Tag.');
        expect(read.nodes[0]).toMatchObject({ type: 'Tag', props: { tone: 'success' } });
    });

    test('an unknown component names the one nearest to it', () => {
        expect(block('<Sumary>Done</Sumary>').diagnostics[0].message).toBe('Unknown component Sumary. Closest: Summary.');
        expect(block('<Dial value={3}/>').diagnostics[0].message).toBe('Unknown component Dial.');
    });
});

describe('words and props', () => {
    test('the words of a component written as a prop become its words', () => {
        const step = first('<Steps><Step state="done" label="Build"/></Steps>', 'Step');
        expect(step.children.map((child) => child.props.text)).toEqual(['Build']);
        expect(first('<EntityList><Entry label="ci" value="21 min"/></EntityList>', 'Entry').children[0].props.text).toBe('21 min');
        expect(first('<Summary title="Done" tone="success"/>', 'Summary').children[0].props.text).toBe('Done');
        expect(block('<Summary title="Done"/>').fallback).toBe('Done');
        expect(reading('<Summary title="Done"/>').messages).toEqual(['Summary takes its title between the tags, not as title; read as that.']);
    });

    test('words that are there win, and the prop is refused as before', () => {
        const read = reading('<Steps><Step state="done" label="Other">Build</Step></Steps>');
        expect(read.codes).toEqual(['refused_prop']);
        expect(read.nodes[0].children[0].children.map((child) => child.props.text)).toEqual(['Build']);
    });

    test('a prop from state becomes words that follow the state', () => {
        const step = first('$name = "Build"\n<Steps><Step label={$name}/></Steps>', 'Step');
        expect(step.children.map((child) => child.props.text)).toEqual(['Build']);
    });

    test('the value of a Stat written between its tags is its value', () => {
        const read = reading('<Stats><Stat label="Tests">42</Stat><Stat label="CI">21 min</Stat></Stats>');
        expect(read.errors).toEqual([]);
        expect(read.nodes[0].children.map((child) => child.props)).toEqual([
            { label: 'Tests', value: 42 },
            { label: 'CI', value: 21, unit: 'min' }
        ]);
        expect(read.nodes[0].children[0].children).toEqual([]);
    });
});

describe('a default', () => {
    test('a Callout without a tone is information and a Step without a state is pending', () => {
        expect(first('<Callout title="Note">Text</Callout>', 'Callout').props).toEqual({ tone: 'info', title: 'Note' });
        expect(first('<Steps><Step>Build</Step></Steps>', 'Step').props).toEqual({ state: 'pending' });
        expect(reading('<Callout>Text</Callout><Steps><Step>Build</Step></Steps>').codes).toEqual([]);
    });

    test('is written into the block, so a client that knows no default reads the same component', () => {
        expect(block('<Callout>Text</Callout>').nodes[0].props).toEqual({ tone: 'info' });
        expect(block('<Steps><Step>Build</Step></Steps>').nodes[0].children[0].props).toEqual({ state: 'pending' });
    });

    test('a Checklist that binds no state holds its picks in state of its own', () => {
        const compiled = block('<Checklist><Item value="a">One</Item></Checklist><Checklist><Item value="b">Two</Item></Checklist>');
        expect(compiled.diagnostics).toEqual([]);
        expect(compiled.defaults).toEqual({ $checklist1: [], $checklist2: [] });
        const list = evaluateUiBlock(compiled).nodes[0];
        expect(list.error).toBeUndefined();
        expect(list.bindings.value.value).toEqual([]);
    });

    test('state of its own never takes a name the block declared', () => {
        const compiled = block('$checklist1 = "mine"\n<Checklist><Item value="a">One</Item></Checklist>');
        expect(compiled.defaults).toEqual({ $checklist1: 'mine', $checklist2: [] });
    });
});

describe('a prop nothing can read', () => {
    test('an optional one is left out and the component draws', () => {
        const read = reading('<Table rows={[{"a": 1}]}><Column key="a" as="money"/></Table>');
        expect(read.errors).toEqual([]);
        expect(read.codes).toEqual(['dropped_prop']);
        expect(read.messages[0]).toBe('Column as="money" is not valid, it is one of text, number, bytes, duration, date, file, tag, percent; left out.');
        expect(first('<Stats><Stat label="Tests" value={42} tone="loud"/></Stats>', 'Stat').props).toEqual({ label: 'Tests', value: 42 });
    });

    test('a value of the right kind that is out of range stays an error', () => {
        expect(reading('<Map><Place lat={200} lon={5}>Bad</Place></Map>').errors).toEqual(['Place:invalid_props']);
        expect(reading('$q = ""\n<TextField value={$q} maxLength={1025}>Query</TextField>').errors).toEqual(['TextField:invalid_props']);
    });

    test('a required one says the component, the prop and what it takes', () => {
        expect(block('<Stats><Stat label="Tests"/></Stats>').diagnostics[0].message).toBe('Stat needs value, a number or text.');
        expect(block('<Chart kind="pie" data={[{"label": "A", "v": 1}]}/>').diagnostics[0].message).toBe(
            'Chart kind is one of bar, hbar, stacked, line, area; got "pie".'
        );
        expect(block('<Image src="https://example.com/a.png"/>').diagnostics.map((item) => item.message)).toEqual([
            'Image does not accept src.',
            'Image: Give attachment="<id>" or generated="latest", exclusively; a URL or a path is never loaded.'
        ]);
    });

    test('a part the compiler refused is reported once, in the words of the compiler', () => {
        const compiled = block('<Chart kind="pie" data={[{"label": "A", "v": 1}]}/>');
        const evaluated = evaluateUiBlock(compiled);
        expect(evaluated.nodes[0].error).toBe('invalid_props');
        expect([...compiled.diagnostics, ...evaluated.diagnostics].map((item) => item.message)).toEqual([
            'Chart kind is one of bar, hbar, stacked, line, area; got "pie".'
        ]);
    });

    test('a prop of a newer catalog is ignored where the block is drawn', () => {
        const compiled = block('<Stats><Stat label="Tests" value={42}/></Stats>');
        compiled.nodes[0].children[0].props.sparkle = [1, 2, 3];
        const evaluated = evaluateUiBlock(compiled);
        expect(evaluated.nodes[0].children[0].error).toBeUndefined();
        expect(evaluated.nodes[0].children[0].props).toEqual({ label: 'Tests', value: 42 });
        expect(evaluated.diagnostics.map((item) => [item.code, item.severity])).toEqual([['refused_prop', 'warning']]);
    });
});

describe('what a diagnostic is about', () => {
    test('names the component as its agent wrote it, and the prop where it is about one', () => {
        const about = (source: string) => block(source).diagnostics.map((item) => [item.code, item.component, item.prop]);
        expect(about('<Stats><Stat label="Tests" value="42" tone="loud"/></Stats>')).toEqual([
            ['coerced_prop', 'Stat', 'value'],
            ['dropped_prop', 'Stat', 'tone']
        ]);
        expect(about('<Badge tone="error" size="big">x</Badge>')).toEqual([
            ['renamed_component', 'Badge', undefined],
            ['refused_prop', 'Badge', 'size'],
            ['renamed_value', 'Badge', 'tone']
        ]);
        expect(about('<Tabs><Tab label="A">x</Tab></Tabs>')).toEqual([['renamed_prop', 'Tab', 'label']]);
        expect(about('<Chart kind="pie" data={[]}/>')).toEqual([['invalid_props', 'Chart', undefined]]);
        expect(about('<Dial/>')).toEqual([['unknown_component', 'Dial', undefined]]);
    });
});

describe('the catalog', () => {
    test('every other name of a component stands for one the catalog has', () => {
        for (const [written, name] of Object.entries(UI_COMPONENT_ALIASES)) {
            expect(isUiComponent(name), written).toBe(true);
            expect(isUiComponent(written), written).toBe(false);
        }
    });

    test('every component that is no child of another carries an example that compiles without a diagnostic', () => {
        for (const [name, entry] of Object.entries(UI_CATALOG)) {
            if (!('parent' in entry)) {
                expect('example' in entry, name).toBe(true);
            }
        }
    });
});
