import { sceneColor, type Scene, type SceneColor, type SceneElement, type ScenePath, type SceneText } from '@adecore/drawing';
import type { DrawingColor } from '@adecore/drawing/protocol';
import { GROUP_DASH, GROUP_LINE_WIDTH, groupLabelBaselineY, layoutOf } from './layout.ts';
import type { DiagramDocument } from './protocol.ts';
import { LINE_WIDTH, arrowHeadPath, dashLengthsOf, edgeLabelLinesOf, edgePath, shapePaths, textLinesOf, type TextLine } from './shapes.ts';
import { DEFAULT_EDGE_TONE, DEFAULT_GROUP_TONE, DEFAULT_NODE_TONE } from './svg.ts';
import { SUB_SIZE } from './text.ts';

function elementAtOrigin(id: string, paths: ScenePath[], text: SceneText[]): SceneElement {
    return { id, x: 0, y: 0, angle: 0, centerX: 0, centerY: 0, paths, text };
}

function centeredText(line: Pick<TextLine, 'text' | 'x' | 'y' | 'size' | 'bold'>, tone: SceneColor): SceneText {
    return { text: line.text, x: line.x, y: line.y, size: line.size, bold: line.bold, align: 'center', font: 'sans', color: tone };
}

/*
 * The scene of a diagram, from the layout and paths `toSvg` draws with. Every element sits in world
 * coordinates, and its id says what it is: `group:<id>`, `edge:<index>` or `node:<id>`.
 */
export function diagramScene(document: Pick<DiagramDocument, 'rev' | 'meta' | 'nodes' | 'groups' | 'edges'>): Scene {
    const layout = layoutOf(document);
    const nodes = new Map(document.nodes.map((node) => [node.id, node]));
    const groups = new Map(document.groups.map((group) => [group.id, group]));
    const elements: SceneElement[] = [];

    for (const box of layout.groups) {
        const group = groups.get(box.id)!;
        const tone = sceneColor(group.tone ?? DEFAULT_GROUP_TONE);

        elements.push(
            elementAtOrigin(
                `group:${box.id}`,
                [{ d: shapePaths('round', box).body, stroke: tone, fill: null, strokeWidth: GROUP_LINE_WIDTH, dash: [...GROUP_DASH] }],
                [
                    {
                        text: group.label,
                        x: box.labelBox.x,
                        y: groupLabelBaselineY(box),
                        size: SUB_SIZE,
                        bold: true,
                        align: 'left',
                        font: 'sans',
                        color: tone
                    }
                ]
            )
        );
    }

    for (const route of layout.edges) {
        const edge = document.edges[route.index]!;
        const tone = sceneColor(edge.tone ?? DEFAULT_EDGE_TONE);
        const paths: ScenePath[] = [{ d: edgePath(route.points), stroke: tone, fill: null, strokeWidth: LINE_WIDTH, dash: dashLengthsOf(edge.style) }];

        if (route.points.length > 0) {
            paths.push({ d: arrowHeadPath(route.points), stroke: null, fill: tone, strokeWidth: 0, dash: null });
        }

        elements.push(elementAtOrigin(`edge:${route.index}`, paths, route.label ? edgeLabelLinesOf(route.label).map((line) => centeredText(line, tone)) : []));
    }

    for (const box of layout.nodes) {
        const node = nodes.get(box.id)!;
        const tone: DrawingColor = node.tone ?? DEFAULT_NODE_TONE;
        const shape = shapePaths(node.shape, box);
        const paths: ScenePath[] = [{ d: shape.body, stroke: sceneColor(tone), fill: sceneColor(tone, 'paper'), strokeWidth: LINE_WIDTH, dash: null }];

        if (shape.detail) {
            paths.push({ d: shape.detail, stroke: sceneColor(tone), fill: null, strokeWidth: LINE_WIDTH, dash: null });
        }

        elements.push(
            elementAtOrigin(
                `node:${node.id}`,
                paths,
                textLinesOf(box, node.shape).map((line) => centeredText(line, sceneColor(line.muted ? 'muted' : 'ink')))
            )
        );
    }

    return { rev: document.rev, bounds: layout.bounds, elements };
}
