import { afterEach, beforeEach, expect, setSystemTime, test } from 'bun:test';
import { z } from 'zod';
import { compileUiBlock, type UiNode } from './compiler.ts';
import { uiNodeQueries } from './node-queries.ts';

// A stopped clock, so a slow runner cannot spend the time budget of a UI block before it is built.
beforeEach(() => setSystemTime(Date.now()));
afterEach(() => setSystemTime());

const schemas = { rows: z.object({}).strict(), status: z.object({}).strict() };

/* Every written node of a block by its type and, for a Stat, its label. */
function byName(nodes: readonly UiNode[], into = new Map<string, string>()): Map<string, string> {
    for (const node of nodes) {
        const label = node.props.label;
        const name = typeof label === 'string' ? `${node.type}:${label}` : node.type;
        into.set(name, node.id);
        byName(node.children, into);
    }

    return into;
}

test('a node reads the queries its expressions name, and those of the Each it stands in', () => {
    const block = compileUiBlock(
        '$rows = @Query("rows", {})\n$status = @Query("status", {})\n<Stats><Stat label="Open" value={$status.open}/><Stat label="Fixed" value={3}/></Stats><Each items={$rows} as="row"><Tag>{row.name}</Tag></Each><Callout tone="info">Plain</Callout>',
        { id: 'b', final: true, querySchemas: schemas }
    );

    expect(block.diagnostics).toEqual([]);

    const ids = byName(block.nodes);
    const queries = uiNodeQueries(block);

    expect(queries[ids.get('Stat:Open')!]).toEqual(['$status']);
    expect(queries[ids.get('Each')!]).toEqual(['$rows']);
    expect(queries[ids.get('Tag')!]).toEqual(['$rows']);
    expect(queries).not.toHaveProperty(ids.get('Stat:Fixed')!);
    expect(queries).not.toHaveProperty(ids.get('Callout')!);
    expect(queries).not.toHaveProperty(ids.get('Stats')!);
});

test('a block without queries has no node that reads one', () => {
    const block = compileUiBlock('<Stats><Stat label="Fixed" value={3}/></Stats>', { id: 'b', final: true });

    expect(uiNodeQueries(block)).toEqual({});
});
