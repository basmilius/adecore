import { DEFAULT_PALETTE, readingOrder, toSvg } from '../src/index.ts';
import { DrawingDocumentSchema } from '../src/protocol.ts';

const document = DrawingDocumentSchema.parse({
    version: 1,
    rev: 0,
    elements: [
        {
            kind: 'note',
            id: 'note-1',
            x: 0,
            y: 0,
            w: 180,
            h: 100,
            stroke: 'ink',
            strokeWidth: 1,
            seed: 7,
            text: 'Review the result',
            size: 20,
            fillColor: 'yellow'
        }
    ]
});
console.log(readingOrder(document.elements));
console.log(toSvg(document.elements, { palette: DEFAULT_PALETTE }));
