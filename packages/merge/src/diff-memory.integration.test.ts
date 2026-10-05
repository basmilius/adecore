import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';

for (const [length, count] of [
    [5000, 1],
    [3000, 1500]
] as const) {
    test(`a diff of two files of ${length} lines that differ on every other line stays under 20 MB`, () => {
        // JSC's peak is process-wide; a fresh process keeps other packages' tests out of the measurement.
        const script = `
            import { memoryUsage } from 'bun:jsc';
            import { diffLines } from ${JSON.stringify(import.meta.resolve('./diff.ts'))};
            const left = Array.from({ length: ${length} }, (_, index) => index % 2 === 0 ? 'same ' + index : 'left ' + index);
            const right = Array.from({ length: ${length} }, (_, index) => index % 2 === 0 ? 'same ' + index : 'right ' + index);
            Bun.gc(true);
            const before = memoryUsage().current;
            const changes = diffLines(left, right);
            console.log(JSON.stringify({ peak: memoryUsage().peak - before, count: changes.length }));
        `;
        const result = JSON.parse(execFileSync(process.execPath, ['--eval', script], { encoding: 'utf8' }));
        expect(result.peak).toBeLessThan(20 * 1024 * 1024);
        expect(result.count).toBe(count);
    });
}
