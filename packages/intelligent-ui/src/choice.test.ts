import { expect, test } from 'bun:test';
import { compileUiBlock } from './compiler.ts';
import { uiValidatedState } from './query.ts';
import { evaluateUiBlock, resolveUiChoice, UiState, uiInputValues } from './runtime.ts';

const source = `$count = 2
$readOnly = "original"
<Slider value={$count} min={1} max={5}>Count</Slider>
<Choices><Choice context={"Build " + $count}>Build</Choice><Choice disabled={true}>Closed</Choice></Choices>`;
function fixture(text = source) {
    const block = compileUiBlock(text, { id: 'block', final: true });
    expect(block.diagnostics).toEqual([]);
    const choices = evaluateUiBlock(block).nodes.find((node) => node.type === 'Choices')!;
    return { block, choice: choices.children[0].id, closed: choices.children[1]?.id };
}

test('choice text comes from the stored block and declared input values', () => {
    const { block, choice } = fixture();
    const state = new UiState(block);
    state.set('$count', 4);
    expect(uiInputValues(block, state)).toEqual({ $count: 4 });
    expect(resolveUiChoice(block, choice, uiInputValues(block, state))).toEqual({ label: 'Build', context: 'Build 4', values: { $count: 4 } });
});

test('a choice cannot overwrite non-input state or invent variables', () => {
    const { block, choice } = fixture();
    for (const values of [{ $readOnly: 'injected' }, { $unknown: 'injected' }, { $count: 'four' }, { $count: 9 }]) {
        expect(() => resolveUiChoice(block, choice, values)).toThrow();
    }
});

test('incomplete, unknown, disabled and missing choices cannot send', () => {
    const { block, choice, closed } = fixture();
    expect(() => resolveUiChoice({ ...block, complete: false }, choice)).toThrow();
    expect(() => resolveUiChoice({ ...block, catalogVersion: 999 }, choice)).toThrow();
    expect(() => resolveUiChoice(block, closed!)).toThrow();
    expect(() => resolveUiChoice(block, 'not-a-node')).toThrow();
});

test('a hidden choice is unavailable, including when changed input hides it', () => {
    const { block, choice } = fixture(`$show = true
<Switch value={$show}>Show</Switch><Show when={$show}><Choices><Choice>Continue</Choice></Choices></Show>`);
    expect(resolveUiChoice(block, choice).context).toBe('Continue');
    expect(() => resolveUiChoice(block, choice, { $show: false })).toThrow();
});

test('each choices use their evaluated id and item context', () => {
    const block = compileUiBlock(`<Each items={["a", "b"]} as="row"><Choices><Choice context={"Do " + row}>{row}</Choice></Choices></Each>`, {
        id: 'block',
        final: true
    });
    const evaluated = evaluateUiBlock(block);
    const choice = evaluated.nodes[1].children[0];
    expect(resolveUiChoice(block, choice.id)).toMatchObject({ label: 'b', context: 'Do b' });
});

test('segmented and checklist submissions must use their visible options', () => {
    for (const [text, values] of [
        [
            `$pick = "a"
<Segmented value={$pick}><Option value="a">A</Option></Segmented><Choices><Choice>Go</Choice></Choices>`,
            { $pick: 'invented' }
        ],
        [
            `$pick = ["a"]
<Checklist value={$pick}><Item value="a">A</Item></Checklist><Choices><Choice>Go</Choice></Choices>`,
            { $pick: ['invented'] }
        ]
    ] as const) {
        const { block, choice } = fixture(text);
        expect(() => resolveUiChoice(block, choice, values)).toThrow();
    }
});

test('oversized and prototype-bearing input values are refused', () => {
    const { block, choice } = fixture();
    expect(() => resolveUiChoice(block, choice, { $count: 'x'.repeat(65537) })).toThrow();
    expect(() => resolveUiChoice(block, choice, JSON.parse('{"__proto__":true}'))).toThrow();
});

test('every visible control bound to a changed value must accept it', () => {
    const { block, choice } = fixture(
        '$count = 2\n<Slider value={$count} min={1} max={10}/><Slider value={$count} min={1} max={5}/><Choices><Choice>Go</Choice></Choices>'
    );
    expect(() => resolveUiChoice(block, choice, { $count: 7 })).toThrow();
});

test('a partly unreadable choice label cannot send a different label', () => {
    const { block, choice } = fixture('<Choices><Choice context="Run checks">Check {$missing}</Choice></Choices>');
    expect(() => resolveUiChoice(block, choice)).toThrow();
});

test('a value a visible Button sets can be sent, and no other value of its variable', () => {
    const { block, choice } = fixture(`$mode = "all"
$hidden = "none"
<Button action={@Set($mode, "failed")}>Failed only</Button><Button action={@Reset()}>Reset</Button>
<Show when={false}><Button action={@Set($hidden, "shown")}>Hidden</Button></Show><Button action={@Set($hidden, "off")} disabled={true}>Off</Button>
<Choices><Choice context={"Show " + $mode}>Show</Choice></Choices>`);
    const state = new UiState(block);
    const pressed = evaluateUiBlock(block, state).nodes[0];
    pressed.onAction!();
    expect(uiInputValues(block, state)).toEqual({ $mode: 'failed', $hidden: 'none' });
    expect(resolveUiChoice(block, choice, uiInputValues(block, state))).toEqual({
        label: 'Show',
        context: 'Show failed',
        values: { $mode: 'failed', $hidden: 'none' }
    });
    expect(uiValidatedState(block, { $mode: 'failed' }).scope().$mode).toBe('failed');
    for (const values of [{ $mode: 'injected' }, { $hidden: 'shown' }, { $hidden: 'off' }]) {
        expect(() => resolveUiChoice(block, choice, values)).toThrow();
        expect(() => uiValidatedState(block, values)).toThrow();
    }
});
