import { resolve } from 'node:path';
import { measurePairs, type PerformanceCase } from './paired-performance';

const baselineRoot = process.argv[2];

if (!baselineRoot) {
    throw new Error('Usage: bun --conditions=source scripts/benchmark-structures.ts <baseline checkout>');
}

const candidateRoot = resolve(import.meta.dir, '..');

async function load(root: string) {
    const modules = await Promise.all([
        import(resolve(root, 'packages/ui/src/workspace/model.ts')),
        import(resolve(root, 'packages/drawing/src/geometry.ts')),
        import(resolve(root, 'packages/database/src/table/grid-rows.ts')),
        import(resolve(root, 'packages/merge/src/resolve.ts')),
        import(resolve(root, 'packages/diagram/src/layout.ts'))
    ]);

    return Object.assign({}, ...modules);
}

const before = await load(resolve(baselineRoot));
const after = await load(candidateRoot);
const cases: PerformanceCase[] = [];

for (const size of [16, 128]) {
    const panes = Array.from({ length: size }, (_, index) => ({ type: 'pane', id: `pane-${index}`, views: [`view-${index}`], active: `view-${index}` }));
    const layout = { type: 'split', id: 'root', axis: 'x', sizes: panes.map(() => 1), children: panes };

    for (const id of ['pane-0', `pane-${size - 1}`, 'absent']) {
        cases.push({ name: `findSplitNode/${size}/${id}`, before: () => before.findSplitNode(layout, id), after: () => after.findSplitNode(layout, id) });
    }
}

for (const size of [20, 200, 1000]) {
    const elements = Array.from({ length: size }, (_, index) => ({ id: `rect-${index}`, kind: 'rectangle', x: index, y: -index, w: 20, h: 10 }));
    const columns = Array.from({ length: size }, (_, index) => ({ name: `column-${index}`, type: 'text' }));
    const structure = { columns: [...columns].reverse().map((column) => ({ ...column, nullable: true })), primaryKey: [], foreignKeys: [] };
    cases.push(
        { name: `boundsOfElements/${size}`, before: () => before.boundsOfElements(elements), after: () => after.boundsOfElements(elements) },
        {
            name: `buildGridColumns/${size}`,
            before: () => before.buildGridColumns({ columns }, structure),
            after: () => after.buildGridColumns({ columns }, structure)
        }
    );
}

for (const size of [100, 1000, 5000]) {
    const base = Array.from({ length: size }, (_, index) => `base ${index}`);
    const additions = Array.from({ length: size }, (_, index) => `added ${index}`);
    const block = { kind: 'conflict', base, ours: [...base, ...additions], theirs: base };
    const nodes = Array.from({ length: size }, (_, index) => ({ id: `node-${index}` }));
    const edges = nodes.slice(1).map((node, index) => ({ from: nodes[index]!.id, to: node.id }));
    cases.push(
        { name: `wandLines/additions/${size}`, before: () => before.wandLines(block), after: () => after.wandLines(block) },
        { name: `layersOf/${size}`, before: () => [...before.layersOf(nodes, edges)], after: () => [...after.layersOf(nodes, edges)] }
    );
}

console.log(JSON.stringify({ runtime: Bun.version, baselineRoot, candidateRoot, ...measurePairs(cases) }, null, 2));
