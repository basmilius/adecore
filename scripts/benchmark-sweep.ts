import { resolve } from 'node:path';
import { measurePairs, type PerformanceCase } from './paired-performance';

const baselineRoot = process.argv[2];

if (!baselineRoot) {
    throw new Error('Usage: bun --conditions=source scripts/benchmark-sweep.ts <baseline checkout>');
}

const candidateRoot = resolve(import.meta.dir, '..');

async function load(root: string) {
    const [text, plan, timeline, merge] = await Promise.all([
        import(resolve(root, 'packages/agent-contracts/src/text.ts')),
        import(resolve(root, 'packages/plan/src/tree.ts')),
        import(resolve(root, 'packages/charts/src/timeline-layout.ts')),
        import(resolve(root, 'packages/merge/src/resolve.ts'))
    ]);

    return { ...text, ...plan, ...timeline, ...merge };
}

const before = await load(resolve(baselineRoot));
const after = await load(candidateRoot);
const cases: PerformanceCase[] = [];

for (const [label, text] of [
    ['ascii', 'ordinary source line\r\n'.repeat(10_000)],
    ['unicode', 'Hé 👩‍💻 é 日本語\n'.repeat(10_000)]
] as const) {
    for (const max of [80, 500, 4096]) {
        cases.push({ name: `clipText/${label}/${max}`, before: () => before.clipText(text, max), after: () => after.clipText(text, max) });
    }
}

for (const size of [100, 250]) {
    const items = Array.from({ length: size / 10 }, (_, group) => ({
        id: `group-${group}`,
        type: 'section',
        title: 'Group',
        items: Array.from({ length: 10 }, (_, step) => ({ id: `${group}-${step}`, type: 'step', title: 'Work', state: step % 2 ? 'active' : 'done' }))
    }));

    for (const operation of ['allItems', 'allSteps', 'leafSteps', 'planProgress', 'activeStepIds'] as const) {
        const input = operation === 'activeStepIds' ? { items } : items;
        cases.push({ name: `${operation}/${size}`, before: () => before[operation](input), after: () => after[operation](input) });
    }
}

for (const size of [100, 1000, 10_000]) {
    const spans = Array.from({ length: size }, (_, index) => ({
        id: `span-${index}`,
        start: (index * 7919) % size,
        duration: 5,
        parent: index % 10 ? `span-${index - (index % 10)}` : null
    }));
    cases.push(
        { name: `timelineTree/${size}`, before: () => before.timelineTree(spans), after: () => after.timelineTree(spans) },
        { name: `timelineExtent/${size}`, before: () => before.timelineExtent(spans), after: () => after.timelineExtent(spans) }
    );
}

for (const size of [100, 1000]) {
    const base = Array.from({ length: size }, (_, index) => `line ${index}`);
    const block = { kind: 'conflict', base, ours: [...base, 'new'], theirs: base.slice(0, size / 2) };
    cases.push(
        { name: `wandLines/${size}`, before: () => before.wandLines(block), after: () => after.wandLines(block) },
        { name: `fingerprint/${size}`, before: () => before.fingerprint(block), after: () => after.fingerprint(block) }
    );
}

console.log(JSON.stringify({ runtime: Bun.version, baselineRoot, candidateRoot, ...measurePairs(cases) }, null, 2));
