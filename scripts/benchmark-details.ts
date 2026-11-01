import { deepStrictEqual } from 'node:assert';
import { resolve } from 'node:path';
import type { ChatItem } from '../packages/agent-contracts/src/chat.ts';

const baselineRoot = process.argv[2];

if (!baselineRoot) {
    throw new Error('Usage: bun --conditions=source scripts/benchmark-details.ts <baseline checkout>');
}

const candidateRoot = resolve(import.meta.dir, '..');

async function load(root: string) {
    const [contracts, log, tree] = await Promise.all([
        import(resolve(root, 'packages/agent-contracts/src/chat.ts')),
        import(resolve(root, 'packages/agents/src/chat/chat-log.ts')),
        import(resolve(root, 'packages/ui/src/file-tree/helpers.ts'))
    ]);

    return { ...contracts, ...log, ...tree };
}

const before = await load(resolve(baselineRoot));
const after = await load(candidateRoot);
const items = Array.from({ length: 10_000 }, (_, index): ChatItem => {
    const shared = { id: `item-${index}`, createdAt: index, turnId: `turn-${Math.floor(index / 100)}` };

    if (index % 20 === 1) {
        return { ...shared, kind: 'subagent', status: index % 100 === 1 ? 'running' : 'done', finishedAt: index + 1 } as ChatItem;
    }

    return index % 20 === 0
        ? { ...shared, kind: 'user', text: 'A message with enough words to appear in the outline.' }
        : { ...shared, kind: 'assistant', text: 'An answer.', streaming: false };
});

const marked = new Set(['item-99', 'item-999']);
const rows = Array.from({ length: 10_000 }, (_, index) => ({
    path: `src/folder-${index}/`,
    kind: index % 5 === 0 ? 'directory' : 'file',
    isExpanded: index % 10 !== 0
}));

const collapsed = rows.filter((row) => row.kind === 'directory' && !row.isExpanded).map((row) => row.path.slice(0, -1));

function logFixture(api: typeof before, length: number) {
    return new api.ChatLog(null, {
        seq: length,
        resetSeq: 0,
        lines: Array.from({ length }, (_, index) => ({ seq: index + 1, at: index, event: { type: 'delta', itemId: 'answer', text: 'word' } }))
    });
}

const cases: Array<{ name: string; before: () => unknown[] | null; after: () => unknown[] | null }> = [];

for (const length of [100, 10_000]) {
    const original = logFixture(before, length);
    const changed = logFixture(after, length);

    for (const remaining of [0, 10, length]) {
        cases.push({
            name: `log.after/${length}/${remaining}-events`,
            before: () => original.after(length - remaining),
            after: () => changed.after(length - remaining)
        });
    }
}

for (const size of [100, 1000, 10_000]) {
    const thread = items.slice(0, size);
    const visible = rows.slice(0, size);
    const folded = collapsed.slice(0, size / 10);

    cases.push(
        { name: `activeSubagents/${size}`, before: () => before.activeSubagents(thread), after: () => after.activeSubagents(thread) },
        { name: `outlineItems/${size}`, before: () => before.outlineItems(thread, marked), after: () => after.outlineItems(thread, marked) },
        { name: `collapsedPathsOf/${size}`, before: () => before.collapsedPathsOf(visible), after: () => after.collapsedPathsOf(visible) },
        {
            name: `mergeCollapsedPaths/${size}`,
            before: () => before.mergeCollapsedPaths(folded, visible),
            after: () => after.mergeCollapsedPaths(folded, visible)
        }
    );
}

let checksum = 0;

function batch(run: () => unknown[] | null, iterations: number): number {
    const started = performance.now();

    for (let index = 0; index < iterations; index++) {
        checksum += run()?.length ?? 0;
    }

    return (performance.now() - started) / iterations;
}

function distribution(samples: number[]) {
    const sorted = [...samples].sort((left, right) => left - right);

    return { medianMs: sorted[Math.floor(sorted.length / 2)]!, p95Ms: sorted[Math.floor(sorted.length * 0.95)]!, samplesMs: samples };
}

function iterationsFor(run: () => unknown[] | null): number {
    let iterations = 1;

    while (batch(run, iterations) * iterations < 10 && iterations < 1_048_576) {
        iterations *= 2;
    }

    return iterations;
}

const results = [];

for (const entry of cases) {
    deepStrictEqual(entry.after(), entry.before(), entry.name);
    const beforeIterations = iterationsFor(entry.before);
    const afterIterations = iterationsFor(entry.after);
    const original: number[] = [];
    const changed: number[] = [];

    for (let sample = 0; sample < 31; sample++) {
        if (sample % 2 === 0) {
            original.push(batch(entry.before, beforeIterations));
            changed.push(batch(entry.after, afterIterations));
        } else {
            changed.push(batch(entry.after, afterIterations));
            original.push(batch(entry.before, beforeIterations));
        }
    }

    const baseline = distribution(original);
    const candidate = distribution(changed);
    results.push({ name: entry.name, beforeIterations, afterIterations, baseline, candidate, speedup: baseline.medianMs / candidate.medianMs });
}

console.log(
    JSON.stringify(
        { runtime: Bun.version, platform: `${process.platform}/${process.arch}`, baselineRoot, candidateRoot, samples: 31, checksum, results },
        null,
        2
    )
);
