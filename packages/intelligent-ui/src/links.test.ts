import { expect, test } from 'bun:test';
import { compileUiBlock } from './compiler.ts';
import { uiLinkTargets } from './links.ts';

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
