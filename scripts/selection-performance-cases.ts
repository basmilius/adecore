import type { DocumentModel } from '../packages/editor-core/src/document.ts';
import type { PerformanceCase } from './paired-performance.ts';

type DocumentApi = { DocumentModel: typeof DocumentModel };

export function selectionCases(before: DocumentApi, after: DocumentApi): PerformanceCase[] {
    const cases: PerformanceCase[] = [];

    const fixtures = [
        ...[0, 10, 100, 1000].map((depth) => ({
            name: String(depth),
            text: `${'call(\n'.repeat(depth)}  éclair + second\n${')\n'.repeat(depth)}`,
            offset: depth * 6 + 4
        })),
        ...[10, 100, 1000].map((lines) => ({ name: `flat-${lines}`, text: 'call(éclair + second);\n'.repeat(lines), offset: Math.floor(lines / 2) * 23 + 7 }))
    ];

    for (const { name, text, offset } of fixtures) {
        for (const direction of ['forward', 'backward', 'caret'] as const) {
            const prepare = (api: DocumentApi) => {
                const model = new api.DocumentModel(text);
                const selection = { anchor: direction === 'backward' ? offset + 1 : offset, head: direction === 'forward' ? offset + 1 : offset };
                model.setSelections([selection]);
                model.expandSelectionTo([]);

                return () => {
                    model.setSelections([selection]);
                    model.expandSelectionTo([]);

                    return model.getSelections();
                };
            };

            cases.push({ name: `selection/${name}/${direction}`, before: prepare(before), after: prepare(after) });
        }
    }

    return cases;
}
