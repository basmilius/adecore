import { centerOf, rotatePoint, unionOf, type Rect } from '@adecore/utils/geometry';
import { pathsOfElement } from './paths.ts';
import type { DrawingAlign, DrawingColor, DrawingDocument, DrawingElement, DrawingFont } from './protocol.ts';
import { approximateMeasure, fontOf, lineAnchorX, lineBaselineY, linesOf } from './text.ts';

/* A palette name and which of the theme's palettes to read it from: `paper` and `edge` are the sheets of a note. */
export interface SceneColor {
    tone: DrawingColor;
    palette: 'ink' | 'paper' | 'edge';
}

export interface ScenePath {
    d: string;
    stroke: SceneColor | null;
    fill: SceneColor | null;
    strokeWidth: number;
    dash: number[] | null;
}

export interface SceneText {
    text: string;
    x: number;
    /* The baseline, in the element's local coordinate system. */
    y: number;
    size: number;
    bold: boolean;
    align: DrawingAlign;
    font: DrawingFont;
    color: SceneColor;
}

export interface SceneElement {
    id: string;
    x: number;
    y: number;
    /* Translate by x and y, then rotate by `angle` radians about (`centerX`, `centerY`) in the element's own frame. */
    angle: number;
    centerX: number;
    centerY: number;
    paths: ScenePath[];
    text: SceneText[];
}

/*
 * A document as a native painter draws it: paths and text lines with palette names, never colors, so it
 * reads the same geometry as `toSvg`. Elements go back to front, each drawing its paths before its text.
 */
export interface Scene {
    rev: number;
    bounds: Rect;
    elements: SceneElement[];
}

export function sceneColor(tone: DrawingColor, palette: SceneColor['palette'] = 'ink'): SceneColor {
    return { tone, palette };
}

function sceneText(element: DrawingElement): SceneText[] {
    if (element.kind !== 'text' && element.kind !== 'note') {
        return [];
    }

    const x = lineAnchorX(element);

    return linesOf(element, approximateMeasure(element.size, element.font)).map((text, index) => ({
        text,
        x,
        y: lineBaselineY(element, index),
        size: element.size,
        bold: false,
        align: element.align ?? 'left',
        font: fontOf(element.font),
        color: sceneColor(element.stroke)
    }));
}

function scenePaths(element: DrawingElement): ScenePath[] {
    const note = element.kind === 'note';

    return pathsOfElement(element).map((path) => {
        if (path.role === 'stroke') {
            return {
                d: path.d,
                stroke: note ? sceneColor(element.fillColor ?? element.stroke, 'edge') : sceneColor(element.stroke),
                fill: null,
                strokeWidth: path.strokeWidth,
                dash: path.dash
            };
        }

        const fill = path.role === 'ink' ? sceneColor(element.stroke) : sceneColor(element.fillColor ?? element.stroke, note ? 'paper' : 'ink');
        const hachure = path.role === 'fill' && path.strokeWidth > 0 && element.fill === 'hachure';

        return { d: path.d, stroke: hachure ? fill : null, fill: hachure ? null : fill, strokeWidth: path.strokeWidth, dash: path.dash };
    });
}

function rotatedBounds(elements: readonly DrawingElement[]): Rect {
    const corners = elements.flatMap((element) => {
        const center = centerOf(element);

        return [
            [0, 0],
            [element.w, 0],
            [0, element.h],
            [element.w, element.h]
        ].map(([dx, dy]) => {
            const point = rotatePoint({ x: element.x + dx!, y: element.y + dy! }, center, element.angle ?? 0);

            return { ...point, w: 0, h: 0 };
        });
    });

    return unionOf(corners) ?? { x: 0, y: 0, w: 0, h: 0 };
}

/* The scene of a drawing: the paths of `pathsOfElement` and the lines of `linesOf` placed as `toSvg` places them, with the bounds of the rotated elements. */
export function drawingScene(document: Pick<DrawingDocument, 'rev' | 'elements'>): Scene {
    return {
        rev: document.rev,
        bounds: rotatedBounds(document.elements),
        elements: document.elements.map((element) => ({
            id: element.id,
            x: element.x,
            y: element.y,
            angle: element.angle ?? 0,
            centerX: element.w / 2,
            centerY: element.h / 2,
            paths: scenePaths(element),
            text: sceneText(element)
        }))
    };
}
