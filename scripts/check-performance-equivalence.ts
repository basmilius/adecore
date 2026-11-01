import { deepStrictEqual } from 'node:assert';
import { resolve } from 'node:path';

const baselineRoot = process.argv[2];

if (!baselineRoot) {
    throw new Error('Usage: bun --conditions=source scripts/check-performance-equivalence.ts <baseline checkout>');
}

async function load(root: string) {
    const [text, plan, timeline, merge, drawing, grid, workspace] = await Promise.all([
        import(resolve(root, 'packages/agent-contracts/src/text.ts')),
        import(resolve(root, 'packages/plan/src/tree.ts')),
        import(resolve(root, 'packages/charts/src/timeline-layout.ts')),
        import(resolve(root, 'packages/merge/src/resolve.ts')),
        import(resolve(root, 'packages/drawing/src/geometry.ts')),
        import(resolve(root, 'packages/database/src/table/grid-rows.ts')),
        import(resolve(root, 'packages/ui/src/workspace/model.ts'))
    ]);

    return { ...text, ...plan, ...timeline, ...merge, ...drawing, ...grid, ...workspace };
}

const before = await load(resolve(baselineRoot));
const after = await load(resolve(import.meta.dir, '..'));
let seed = 20261031;

function random(limit: number): number {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

    return seed % limit;
}

for (let sample = 0; sample < 1000; sample++) {
    const symbols = ['a', 'b', '\r', '\n', '\0', 'é', '\u0301', '\u200d', '😀', '🇳🇱', 'क्', '👩‍💻'];
    const text = Array.from({ length: random(80) }, () => symbols[random(symbols.length)]).join('');

    for (const max of [random(100), 0, -1, 2.5, Number.NaN]) {
        deepStrictEqual(after.clipText(text, max), before.clipText(text, max), `clipText ${sample} ${max}`);
    }

    const spans = Array.from({ length: random(40) }, (_, index) => ({
        id: `span-${index}`,
        parent: random(3) ? `span-${random(40)}` : null,
        start: random(100),
        duration: random(100)
    }));
    deepStrictEqual(after.timelineTree(spans), before.timelineTree(spans), `timelineTree ${sample}`);
    deepStrictEqual(after.timelineExtent(spans), before.timelineExtent(spans), `timelineExtent ${sample}`);
    deepStrictEqual(after.timelineExtent(spans, sample), before.timelineExtent(spans, sample), `fixed timelineExtent ${sample}`);
    const base = Array.from({ length: 100 }, (_, index) => `base-${index}`);
    const inner = base.slice(0, random(100));
    const additions = Array.from({ length: random(100) }, () => `added-${random(100)}`);
    const block = { kind: 'conflict', base, ours: [...inner, ...additions, ...(random(2) ? ['base-99'] : [])], theirs: inner };
    deepStrictEqual(after.wandLines(block), before.wandLines(block), `wandLines ${sample}`);
    const rects = Array.from({ length: random(60) }, (_, index) => ({
        id: String(index),
        kind: 'rectangle',
        x: random(100) - 50,
        y: random(100) - 50,
        w: random(100) - 50,
        h: random(100) - 50
    }));
    deepStrictEqual(after.boundsOfElements(rects), before.boundsOfElements(rects), `drawing bounds ${sample}`);
    const panes = rects.map((rect) => ({ id: rect.id, type: 'pane', views: [], active: null }));
    const layout = { type: 'split', id: 'root', axis: 'horizontal', sizes: panes.map(() => 1), children: panes };
    const target = String(random(60));
    deepStrictEqual(after.findSplitNode(layout, target), before.findSplitNode(layout, target), `workspace ${sample}`);
    const columns = Array.from({ length: random(80) }, () => ({ name: `column-${random(40)}`, type: 'TEXT', kind: 'text' }));
    const structure = { columns: columns.map((column) => ({ ...column, nullable: random(2) === 0 })), primaryKey: [], foreignKeys: [] };
    deepStrictEqual(after.buildGridColumns({ columns }, structure), before.buildGridColumns({ columns }, structure), `database columns ${sample}`);
    const items = [
        { id: 'section', type: 'section', items: columns.map((_column, index) => ({ id: String(index), type: 'step', state: index % 2 ? 'active' : 'done' })) }
    ];
    deepStrictEqual(after.allItems(items), before.allItems(items), `plan traversal ${sample}`);
    deepStrictEqual(after.planProgress(items), before.planProgress(items), `plan progress ${sample}`);
}

console.log(JSON.stringify({ seed: 20261031, samples: 1000, comparisons: 14000, result: 'identical' }));
