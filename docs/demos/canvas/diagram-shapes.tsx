import { toSvg } from '@adecore/diagram';
import { DIAGRAM_SHAPES, type DiagramContent } from '@adecore/diagram/protocol';
import { THEME_PALETTE, THEME_PAPER } from '../shared/canvas-theme.ts';

const STYLES = ['solid', 'dashed', 'dotted', 'solid'] as const;

const SHAPES: DiagramContent = {
    meta: { title: 'Shapes and edge styles', direction: 'right' },
    nodes: DIAGRAM_SHAPES.map((shape) => ({ id: shape, label: shape, shape, tone: 'blue' })),
    groups: [],
    edges: STYLES.map((style, index) => ({ from: DIAGRAM_SHAPES[index]!, to: DIAGRAM_SHAPES[index + 1]!, label: style, style }))
};

export default function DiagramShapesDemo() {
    const svg = toSvg(SHAPES, { palette: THEME_PALETTE, paper: THEME_PAPER });

    return <div className="w-full [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
