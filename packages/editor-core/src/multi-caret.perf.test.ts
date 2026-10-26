import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';

describe('many carets', () => {
    it('type at 20,000 carets in a fraction of the time it took to compare every caret with every other', () => {
        const lines = Array.from({ length: 100_000 }, (_, line) => `    const value${line} = compute(alpha, beta);`);
        const document = new DocumentModel(lines.join('\n'));

        const carets = Array.from({ length: 20_000 }, (_, index) => {
            const offset = document.getLine(index * 5).start + 10;

            return { anchor: offset, head: offset };
        });

        document.setSelections(carets);
        const started = performance.now();
        document.typeText('x', { language: 'typescript' });
        const elapsed = performance.now() - started;
        expect(document.getSelectionCount()).toBe(20_000);
        expect(document.getSelections()[19_999]).toEqual({ anchor: carets[19_999]!.head + 20_000, head: carets[19_999]!.head + 20_000 });
        expect(document.getLine(99_995).text.slice(0, 12)).toBe('    const xv');
        // The pairwise merge took over a second here, and still well over 50 ms at 5,000 carets.
        expect(elapsed).toBeLessThan(500);
    });
});
