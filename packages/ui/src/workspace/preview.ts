import type { SplitRect } from './geometry.ts';

/* The gap above the indicator's tab, so it reads as a tab standing in the bar. */
export const TAB_TOP_INSET = 4;

/* The corner of the indicator's tab, and of its body, which is `rounded-sm` like the other drop indicator. */
export const TAB_RADIUS = 6;

export const BODY_RADIUS = 4;

/* The stroke is centered on the path, so the path runs half of it inside the box to keep the outer edge on it. */
export const DROP_STROKE = 2;

/* In the grid's coordinates. A rectangle is a tab with no height standing on a body; for a tab, the box is the cell with its bar. */
export interface DropPreviewShape {
    x: number;
    y: number;
    width: number;
    height: number;

    /* The part of the box above the body that the tab stands in; 0 for a rectangle. */
    barHeight: number;

    tabLeft: number;
    tabWidth: number;
    tabTop: number;
    radius: number;
}

function coordinate(value: number): string {
    return String(Math.round(value * 100) / 100 + 0);
}

/* The tab with no height parks just inside the top left corner, so the corner keeps its radius and a tab target grows out of it. */
export function rectDropPreview({ x, y, width, height }: SplitRect): DropPreviewShape {
    return { x, y, width, height, barHeight: 0, tabLeft: x + BODY_RADIUS, tabWidth: 0, tabTop: y, radius: TAB_RADIUS };
}

/* `origin` is the cell's top left in the grid. */
export function tabDropPreview(drop: TabDrop, origin: { x: number; y: number }): DropPreviewShape {
    return {
        x: origin.x,
        y: origin.y,
        width: drop.width,
        height: drop.height,
        barHeight: drop.barHeight,
        tabLeft: origin.x + drop.left,
        tabWidth: drop.tabWidth,
        tabTop: origin.y + TAB_TOP_INSET,
        radius: TAB_RADIUS
    };
}

/* Two shapes that draw the same outline, so a drag that stays in one place can skip a render. */
export function sameDropPreview(left: DropPreviewShape | null, right: DropPreviewShape | null): boolean {
    if (left === null || right === null) {
        return left === right;
    }

    return (
        left.x === right.x &&
        left.y === right.y &&
        left.width === right.width &&
        left.height === right.height &&
        left.barHeight === right.barHeight &&
        left.tabLeft === right.tabLeft &&
        left.tabWidth === right.tabWidth &&
        left.tabTop === right.tabTop &&
        left.radius === right.radius
    );
}

/*
 * One closed path, so no line runs between tab and body. The commands are the same whatever the
 * numbers (an arc of radius 0 is a straight line), so a transition on `d` can move one outline into another.
 */
export function dropPreviewPath({ x, y, width, height, barHeight, tabLeft, tabWidth, tabTop, radius }: DropPreviewShape, inset = DROP_STROKE / 2): string {
    const left = inset;
    const right = width - inset;
    const bottom = height - inset;
    const top = barHeight + inset;
    const tabStart = Math.max(left, Math.min(tabLeft - x + inset, right));
    const tabEnd = Math.max(tabStart, Math.min(tabLeft - x + tabWidth - inset, right));
    const tabY = Math.min(tabTop - y + inset, top);
    const tabCorner = Math.max(0, Math.min(radius - inset, (tabEnd - tabStart) / 2, top - tabY));
    const bodyCorner = Math.max(0, BODY_RADIUS - inset);
    // A tab flush with a side of the box continues that side, so the body has no corner there.
    const cornerLeft = Math.min(bodyCorner, tabStart - left);
    const cornerRight = Math.min(bodyCorner, right - tabEnd);
    const cornerBottom = Math.max(0, Math.min(bodyCorner, (right - left) / 2, (bottom - top) / 2));

    const at = (px: number, py: number): string => `${coordinate(x + px)},${coordinate(y + py)}`;

    const arc = (corner: number, px: number, py: number): string => `A${coordinate(corner)},${coordinate(corner)} 0 0 1 ${at(px, py)}`;

    return [
        `M${at(left + cornerLeft, top)}`,
        `H${coordinate(x + tabStart)}`,
        `V${coordinate(y + tabY + tabCorner)}`,
        arc(tabCorner, tabStart + tabCorner, tabY),
        `H${coordinate(x + tabEnd - tabCorner)}`,
        arc(tabCorner, tabEnd, tabY + tabCorner),
        `V${coordinate(y + top)}`,
        `H${coordinate(x + right - cornerRight)}`,
        arc(cornerRight, right, top + cornerRight),
        `V${coordinate(y + bottom - cornerBottom)}`,
        arc(cornerBottom, right - cornerBottom, bottom),
        `H${coordinate(x + left + cornerBottom)}`,
        arc(cornerBottom, left, bottom - cornerBottom),
        `V${coordinate(y + top + cornerLeft)}`,
        arc(cornerLeft, left + cornerLeft, top),
        'Z'
    ].join(' ');
}

/* Where a view dragged over a cell's bar would land as a tab, in the cell's own coordinates. */
export interface TabDrop {
    /* The gap in the strip it lands in, counted in tabs from the left. */
    gap: number;

    left: number;
    tabWidth: number;

    /* The cell as a whole, bar included. */
    width: number;

    height: number;
    barHeight: number;
}
