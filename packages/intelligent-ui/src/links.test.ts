import { afterEach, beforeEach, expect, setSystemTime, test } from 'bun:test';
import { z } from 'zod';
import { compileUiBlock } from './compiler.ts';
import { UiLinkResolutionSchema, uiLinkTargets } from './links.ts';

// A stopped clock, so a slow runner cannot spend the time budget of a UI block before it is built.
beforeEach(() => setSystemTime(Date.now()));
afterEach(() => setSystemTime());

test('link targets come only from visible complete supported nodes', () => {
    const block = compileUiBlock('<File path="a.md" line={3}/><Show when={false}><File path="hidden.md"/></Show><Commit sha="--help"/><Node id="node-1"/>', {
        id: 'b',
        final: true
    });

    expect(Object.values(uiLinkTargets(block))).toEqual([
        { type: 'File', path: 'a.md', line: 3 },
        { type: 'Node', id: 'node-1' }
    ]);
});

test('a source that cites a host node links that node, and one with an address links nothing', () => {
    const block = compileUiBlock('<Sources><Source title="Re: Q1 roadmap" node="mail:roadmap"/><Source title="Docs" url="https://adecore.dev"/></Sources>', {
        id: 'b',
        final: true
    });

    expect(Object.values(uiLinkTargets(block))).toEqual([{ type: 'Node', id: 'mail:roadmap' }]);
});

test('a source names an address or a node, never both and never neither', () => {
    const failed = (markup: string) => compileUiBlock(`<Sources>${markup}</Sources>`, { id: 'b', final: true }).diagnostics.length > 0;

    expect(failed('<Source title="Mail" node="mail:1"/>')).toBe(false);
    expect(failed('<Source title="Mail" node="mail:1" url="https://adecore.dev"/>')).toBe(true);
    expect(failed('<Source title="Mail"/>')).toBe(true);
});

test('a resolution keeps no closed object, so a reader that validates its JSON Schema takes a later optional field', () => {
    const schema = JSON.stringify(z.toJSONSchema(UiLinkResolutionSchema, { io: 'input' }));
    const later = { state: 'chip', target: { type: 'File', path: 'a.md', column: 4 } };

    expect(schema).not.toContain('"additionalProperties":false');
    expect(UiLinkResolutionSchema.safeParse(later).success).toBe(true);
});

test('local input can choose a target only through a validated binding', () => {
    const block = compileUiBlock(
        '$path = "a.md"\n<Segmented value={$path}><Option value="a.md">A</Option><Option value="b.md">B</Option></Segmented><File path={$path}/>',
        { id: 'b', final: true }
    );

    expect(Object.values(uiLinkTargets(block, { $path: 'b.md' }))).toEqual([{ type: 'File', path: 'b.md' }]);
    expect(() => uiLinkTargets(block, { $path: '/outside' })).toThrow('allowed values');
    expect(() => uiLinkTargets(block, { $other: true })).toThrow('bindings');
    expect(() => uiLinkTargets({ ...block, complete: false })).toThrow('completed');
});
