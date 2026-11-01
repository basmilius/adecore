import { deepStrictEqual } from 'node:assert';
import { resolve } from 'node:path';
import * as after from '../packages/editor-core/src/document.ts';

const baselineRoot = process.argv[2];

if (!baselineRoot) {
    throw new Error('Usage: bun --conditions=source scripts/check-selection-equivalence.ts <baseline checkout>');
}

const before: typeof after = await import(resolve(baselineRoot, 'packages/editor-core/src/document.ts'));
let seed = 20261101;
let comparisons = 0;

function random(limit: number): number {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

    return seed % limit;
}

for (let sample = 0; sample < 1000; sample++) {
    const newline = sample % 2 === 0 ? '\r\n' : '\n';
    const depth = random(100);
    const words = ['éclair', 'e\u0301clair', '😀', 'call(second)', '"[literal]"', 'one + two'];
    const text = `${'call(['.repeat(depth)}${newline}  ${words[random(words.length)]} ${newline}${'])'.repeat(depth)}`;
    const original = new before.DocumentModel(text);
    const changed = new after.DocumentModel(text);
    const selections = Array.from({ length: 1 + random(3) }, () => ({ anchor: random(text.length + 1), head: random(text.length + 1) }));
    original.setSelections(selections);
    changed.setSelections(selections);

    for (let index = 0; index < 8; index++) {
        const ranges = index === 3 ? selections.map(() => ({ from: random(text.length + 1), to: random(text.length + 1) })) : [];
        deepStrictEqual(changed.expandSelectionTo(ranges), original.expandSelectionTo(ranges), `expanded ${sample}/${index}`);
        deepStrictEqual(changed.getSelections(), original.getSelections(), `selection ${sample}/${index}`);
        comparisons += 2;
    }

    for (let index = 0; index < 8; index++) {
        deepStrictEqual(changed.execute('shrinkSelection'), original.execute('shrinkSelection'), `shrunk ${sample}/${index}`);
        deepStrictEqual(changed.getSelections(), original.getSelections(), `restored ${sample}/${index}`);
        comparisons += 2;
    }

    deepStrictEqual(changed.getText(), text);
    deepStrictEqual(changed.getRevision(), 0);
    comparisons += 2;
}

console.log(JSON.stringify({ seed: 20261101, samples: 1000, comparisons, result: 'identical' }));
