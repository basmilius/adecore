import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test';
import { compileUi } from '@adecore/intelligent-ui';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatHostProvider, type ChatHost } from '../../../host/host';
import { uiKeyCaps } from './key-caps';
import { uiClipPatch } from './patch-clip';
import { UiReply } from './UiReply';

// A stopped clock, so a slow runner cannot spend the time budget of a UI block before it is built.
beforeEach(() => setSystemTime(Date.now()));
afterEach(() => setSystemTime());

const context = { scopeId: 'scope', chatId: 'chat', itemId: 'item', phase: 'final' as const };

function drawn(source: string, host: Partial<ChatHost> = {}): string {
    const text = '```ui\n' + source + '\n```';
    const blocks = compileUi(text, { id: 'item', final: true });

    return renderToStaticMarkup(createElement(ChatHostProvider, { host }, createElement(UiReply, { text, blocks, context })));
}

describe('Meter', () => {
    test('reads its value against its max, with the mark and the tone in words', () => {
        const markup = drawn('<Meter value={142} max={200} mark={160} unit="k" tone="warning" detail="Compacts at 160k">Context</Meter>');
        expect(markup).toContain('role="meter"');
        expect(markup).toContain('aria-label="Context"');
        expect(markup).toContain('aria-valuemax="200"');
        expect(markup).toContain('aria-valuetext="142 k of 200 k, mark at 160 k, Warning"');
        expect(markup).toContain('of 200 k');
        expect(markup).toContain('text-status-needs-you');
        expect(markup).toContain('lucide-triangle-alert');
        expect(markup).toContain('Compacts at 160k');
    });

    test('stands alone against 100 without a max', () => {
        const markup = drawn('<Meter value={71} unit="%">Coverage</Meter>');
        expect(markup).toContain('aria-valuemax="100"');
        expect(markup).toContain('aria-valuetext="71%"');
        expect(markup).not.toContain('of 100');
    });
});

test('Parts draws one bar with a share per part, in the palette or the tone of a part', () => {
    const markup = drawn('<Parts unit="tokens"><Part value={6000000}>Large model</Part><Part value={2000000} tone="danger">Small model</Part></Parts>');
    expect(markup).toContain('aria-label="Parts of the whole"');
    expect(markup).toContain('Large model: 6,000,000 tokens, 75%');
    expect(markup).toContain('Small model: 2,000,000 tokens, 25%');
    expect(markup).toContain('background-color:var(--chart-1)');
    expect(markup).toContain('background-color:var(--status-error)');
    expect(markup).not.toContain('var(--chart-2)');
    // Nothing to divide leaves an empty track and a legend a screen reader reads instead.
    const empty = drawn('<Parts><Part value={0}>Nothing</Part></Parts>');
    expect(empty).toContain('>0%<');
    expect(empty).not.toContain('<ol');
    expect(empty).not.toContain('<ul aria-hidden');
});

test('Changes lists each file with its state, its lines and a note, as text while no host opens it', () => {
    const markup = drawn(
        '<Changes><Change path="src/compiler.ts" added={48} removed={6}>Reads a number</Change><Change path="src/normalize.ts" added={1} state="added"/></Changes>'
    );

    expect(markup).toContain('aria-label="2 changed files"');
    expect(markup).toContain('src/compiler.ts');
    expect(markup).toContain('>+48<');
    expect(markup).toContain('48 lines added');
    expect(markup).toContain('6 lines removed');
    expect(markup).toContain('1 line added');
    expect(markup).toContain('>New<');
    expect(markup).toContain('Reads a number');
    expect(markup).not.toContain('<button');
});

test('Alternatives marks the recommended one and says which points are for and against', () => {
    const markup = drawn(
        '<Alternatives><Alternative title="In the compiler" recommended>One **place**.<Pro>No schema changes</Pro><Con>One more step</Con></Alternative><Alternative title="Per prop">As today.</Alternative></Alternatives>'
    );

    expect(markup).toContain('aria-label="2 options"');
    expect(markup.match(/Recommended/g)).toHaveLength(1);
    expect(markup.match(/ring-accent/g)).toHaveLength(1);
    expect(markup).toContain('One <strong>place</strong>.');
    expect(markup).toMatch(/lucide-plus.*For:.*No schema changes/s);
    expect(markup).toMatch(/lucide-minus.*Against:.*One more step/s);
    expect(markup).toContain('@min-[420px]:grid-cols-2');
});

test('Columns stands its panes side by side, each stacking its children under its title', () => {
    const markup = drawn('<Columns><Pane title="Before">Slow <Tag>48 ms</Tag></Pane><Pane title="After"><Callout>Fast</Callout></Pane></Columns>');
    expect(markup).toContain('@min-[420px]:grid-cols-2');
    expect(markup).toContain('>Before<');
    expect(markup).toContain('>After<');
    expect(markup).toMatch(/<div class="text-xs text-text">Slow /);
    expect(drawn('<Columns><Pane>a</Pane><Pane>b</Pane><Pane>c</Pane></Columns>')).toContain('@min-[420px]:grid-cols-3');
});

test('Tree nests its branches, arrives folded where asked and names a leaf after its file', () => {
    const markup = drawn(
        '<Tree><Branch label="src"><Leaf path="src/compiler.ts" detail="changed"/><Leaf tone="success">normalize_all.ts</Leaf><Branch label="closed" open={false}><Leaf>inner</Leaf></Branch></Branch></Tree>'
    );

    expect(markup).toContain('aria-label="Tree"');
    expect(markup.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(markup.match(/aria-expanded="false"/g)).toHaveLength(1);
    expect(markup).toMatch(/<ul[^>]*hidden=""[^>]*>.*inner/s);
    expect(markup).toContain('>compiler.ts<');
    expect(markup).toContain('>changed<');
    expect(markup).toContain('normalize_all.ts');
    expect(markup).toContain('text-positive');
    expect(markup).toContain('Success');
    // No host resolves the path, so the leaf is text.
    expect(markup.match(/<button/g)).toHaveLength(2);
});

test('Radio is a group of radios with the bound one checked and a line under each', () => {
    const markup = drawn(
        '$scope = "full"\n<Radio value={$scope} label="Scope"><Option value="fast" detail="Only the changed files">Fast</Option><Option value="full" detail="Every suite">Full</Option></Radio>'
    );

    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('>Scope<');
    expect(markup.match(/role="radio"/g)).toHaveLength(2);
    expect(markup).toMatch(/aria-checked="false"[^>]*tabindex="-1"/);
    expect(markup).toMatch(/aria-checked="true"[^>]*tabindex="0"/);
    expect(markup).toContain('Only the changed files');
});

test('a detail shows under a checklist item, and not on the options of Segmented', () => {
    expect(drawn('$picked = []\n<Checklist value={$picked}><Item value="a" detail="Slow on a cold cache">Types</Item></Checklist>')).toContain(
        'Slow on a cold cache'
    );

    expect(drawn('$env = "dev"\n<Segmented value={$env}><Option value="dev" detail="Hidden line">Dev</Option></Segmented>')).not.toContain('Hidden line');
});

test('NumberField is a labeled number input with its range, step and unit', () => {
    const markup = drawn('$runs = 50\n<NumberField value={$runs} min={1} max={500} step={5} unit="runs">Number of runs</NumberField>');
    expect(markup).toMatch(/<label[^>]*>Number of runs<\/label>/);
    expect(markup).toMatch(/<input[^>]*type="number"/);
    expect(markup).toMatch(/<input[^>]*min="1"[^>]*max="500"[^>]*step="5"/);
    expect(markup).toMatch(/<input[^>]*value="50"/);
    expect(markup).toContain('>runs<');
});

describe('Keys', () => {
    test('prints a shortcut the way the platform writes it', () => {
        expect(uiKeyCaps('mod+K', true)).toEqual(['⌘', 'K']);
        expect(uiKeyCaps('mod+K', false)).toEqual(['Ctrl', 'K']);
        expect(uiKeyCaps('Mod + shift + p', false)).toEqual(['Ctrl', 'Shift', 'P']);
        expect(uiKeyCaps('esc', true)).toEqual(['Esc']);
        expect(uiKeyCaps('mod++', false)).toEqual(['Ctrl', '+']);
        expect(uiKeyCaps('g+g', true)).toEqual(['g', 'g']);
        expect(uiKeyCaps('mod+PageDown', true)).toEqual(['⌘', 'PageDown']);
        expect(uiKeyCaps('  ', true)).toEqual([]);
    });

    test('stands inline in the sentence around it, in a paragraph and in a Summary', () => {
        const apple: Partial<ChatHost> = { isApplePlatform: () => true };
        const markup = drawn('Open the palette with <Keys>mod+K</Keys> now', apple);
        expect(markup).toMatch(
            /<div class="text-xs text-text">Open the palette with <span[^>]*inline-flex[^>]*><kbd[^>]*>⌘<\/kbd><kbd[^>]*>K<\/kbd><\/span> now/
        );
        expect(drawn('<Summary>Press <Keys>mod+K</Keys></Summary>', { isApplePlatform: () => false })).toMatch(/Press <span[^>]*><kbd[^>]*>Ctrl<\/kbd>/);
    });
});

test('Quote keeps its words as written, with the source under them and the tone as a word', () => {
    const markup = drawn('<Quote tone="danger" source="The build log" mono>error *TS2362*: the left-hand side</Quote>');
    expect(markup).toContain('<blockquote');
    expect(markup).toContain('font-mono');
    expect(markup).toContain('error *TS2362*: the left-hand side');
    expect(markup).toMatch(/<figcaption[^>]*>The build log<\/figcaption>/);
    expect(markup).toContain('bg-status-error');
    expect(markup).toContain('>Danger<');
    expect(drawn('<Quote>Plain words</Quote>')).not.toContain('font-mono');
});

test('a percent column reads its number through the percent formatter, on the side numbers stand', () => {
    const markup = drawn('<Table rows={[{"job": "Unit", "share": 4.5}]}><Column key="job"/><Column key="share" as="percent"/></Table>');
    expect(markup).toContain('4.5%');
    expect(markup).toMatch(/<td class="[^"]*text-right[^"]*"><span>4\.5%/);
});

test('an area chart describes itself as the other kinds do', () => {
    const markup = drawn('<Chart kind="area" data={[{"label": "Mon", "runs": 3}, {"label": "Tue", "runs": 5}]}/>');
    expect(markup).toContain('role="img"');
    expect(markup).toContain('highest Tue at 5');
});

test('an open Diff stays the text a closed one is while no host reads diffs', () => {
    const markup = drawn('<Diff path="src/compiler.ts" open>Reads a number</Diff>');
    expect(markup).toContain('src/compiler.ts');
    expect(markup).toContain('Reads a number');
    expect(markup).not.toContain('<figure');
});

describe('a clipped patch', () => {
    const patch = [
        'diff --git a/a.ts b/a.ts',
        '--- a/a.ts',
        '+++ b/a.ts',
        '@@ -1,3 +1,4 @@ function one() {',
        ' keep',
        '-old',
        '+new',
        '+more',
        ' tail',
        '@@ -20,2 +21,2 @@',
        ' context',
        '-gone',
        '+back',
        ''
    ].join('\n');

    test('stays whole when it fits', () => {
        expect(uiClipPatch(patch, 200)).toEqual({ patch, clipped: false });
        expect(uiClipPatch(patch, 8)).toEqual({ patch, clipped: false });
    });

    test('gives the hunk it cuts the counts of what is left', () => {
        const { patch: cut, clipped } = uiClipPatch(patch, 3);
        expect(clipped).toBe(true);
        expect(cut.split('\n')).toEqual(['diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '@@ -1,2 +1,2 @@ function one() {', ' keep', '-old', '+new']);
    });

    test('ends on a whole hunk where the limit falls between two', () => {
        const { patch: cut, clipped } = uiClipPatch(patch, 5);
        expect(clipped).toBe(true);
        expect(cut.split('\n').at(-1)).toBe(' tail');
        expect(cut).toContain('@@ -1,3 +1,4 @@ function one() {');
        expect(cut).not.toContain('@@ -20');
    });

    test('names the line before a side the cut left empty', () => {
        const added = ['@@ -5,2 +5,4 @@', '+one', '+two', ' three', ' four'].join('\n');
        expect(uiClipPatch(added, 2).patch.split('\n')[0]).toBe('@@ -4,0 +5,2 @@');
    });
});

describe('CodeBlock', () => {
    test('numbers its lines from start and marks the highlighted ones, before it is highlighted too', () => {
        const markup = drawn('<CodeBlock language="ts" start={98} highlight={[99, 100]}>const a = 1;\nconst b = 2;\nconst c = 3;</CodeBlock>');
        expect(markup).toContain('data-lined=""');
        expect(markup).toContain('--chat-code-digits:3');
        expect(markup).toContain('<span class="line" data-line="98">const a = 1;</span>');
        expect(markup).toContain('<span class="line" data-line="99" data-marked="">const b = 2;</span>');
        expect(markup).toContain('<span class="line" data-line="100" data-marked="">const c = 3;</span>');
    });

    test('marks lines counted from 1 without a start, and shows no number', () => {
        const markup = drawn('<CodeBlock highlight={[2]}>one\ntwo</CodeBlock>');
        expect(markup).toContain('<span class="line">one</span>');
        expect(markup).toContain('<span class="line" data-marked="">two</span>');
        expect(markup).not.toContain('data-line=');
    });

    test('stays one run of text without a start or a highlight', () => {
        const markup = drawn('<CodeBlock language="ts">one\ntwo</CodeBlock>');
        expect(markup).not.toContain('data-lined');
        expect(markup).not.toContain('class="line"');
        expect(markup).toContain('>ts</span>');
    });

    test('shows its file in place of the language, as text with the line while no host opens it', () => {
        const markup = drawn('<CodeBlock language="ts" file="src/total.ts" start={12}>const total = rows.length;</CodeBlock>');
        expect(markup).toContain('src/total.ts:12');
        expect(markup).not.toContain('>ts</span>');
        expect(markup).not.toContain('<button type="button" class="inline-flex');
    });
});
