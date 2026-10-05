import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';

for (const [length, count] of [
    [5000, 1],
    [3000, 1500]
] as const) {
    test(`a diff of two files of ${length} lines that differ on every other line stays under 20 MB`, () => {
        // Counts the bytes of every Int32Array the walk allocates: the process's RSS peak varied by hundreds of megabytes between runners.
        // A fresh process, so the counting class replaces Int32Array before the diff module first uses it.
        const script = `
            let allocated = 0;
            globalThis.Int32Array = class extends Int32Array {
                constructor(...args) {
                    super(...args);
                    allocated += this.byteLength;
                }
            };
            const { diffLines } = await import(${JSON.stringify(import.meta.resolve('./diff.ts'))});
            const left = Array.from({ length: ${length} }, (_, index) => index % 2 === 0 ? 'same ' + index : 'left ' + index);
            const right = Array.from({ length: ${length} }, (_, index) => index % 2 === 0 ? 'same ' + index : 'right ' + index);
            const changes = diffLines(left, right);
            console.log(JSON.stringify({ allocated, count: changes.length }));
        `;
        const result = JSON.parse(execFileSync(process.execPath, ['--eval', script], { encoding: 'utf8' }));
        expect(result.allocated).toBeGreaterThan(0);
        expect(result.allocated).toBeLessThan(20 * 1024 * 1024);
        expect(result.count).toBe(count);
    });
}
