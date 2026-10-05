import { layoutOf, readingOrder, toSvg } from '../src/index.ts';
import { DiagramDocumentSchema, diagramProblemIn } from '../src/protocol.ts';

const document = DiagramDocumentSchema.parse({
    version: 1,
    rev: 0,
    meta: { title: 'Delivery', direction: 'right' },
    nodes: [
        { id: 'draft', label: 'Draft' },
        { id: 'review', label: 'Review', shape: 'diamond' }
    ],
    groups: [],
    edges: [{ from: 'draft', to: 'review' }]
});
const problem = diagramProblemIn(document);
if (problem !== null) {
    throw new Error(problem);
}
const layout = layoutOf(document);
console.log(readingOrder(document));
console.log(toSvg(document, { layout }));
