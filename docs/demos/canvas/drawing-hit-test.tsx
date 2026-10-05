import { useState, type PointerEvent } from 'react';
import { boundsOf, boundsOfElements, DEFAULT_SVG_MARGIN, elementAt, handlePoint, RESIZE_HANDLES, toSvg } from '@adecore/drawing';
import type { DrawingElement } from '@adecore/drawing/protocol';
import { THEME_EDGE, THEME_PALETTE, THEME_PAPER } from '../shared/canvas-theme.ts';
import { SKETCH } from '../shared/sketch.ts';

const SVG = toSvg(SKETCH, { palette: THEME_PALETTE, paper: THEME_PAPER, edge: THEME_EDGE });

// The same box toSvg gives its viewBox, so a pointer maps onto world units.
const bounds = boundsOfElements(SKETCH)!;
const VIEW = { x: bounds.x - DEFAULT_SVG_MARGIN, y: bounds.y - DEFAULT_SVG_MARGIN, w: bounds.w + DEFAULT_SVG_MARGIN * 2, h: bounds.h + DEFAULT_SVG_MARGIN * 2 };

export default function DrawingHitTestDemo() {
    const [hovered, setHovered] = useState<DrawingElement | null>(null);

    function onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const area = event.currentTarget.getBoundingClientRect();
        const point = {
            x: VIEW.x + ((event.clientX - area.left) / area.width) * VIEW.w,
            y: VIEW.y + ((event.clientY - area.top) / area.height) * VIEW.h
        };
        setHovered(elementAt(SKETCH, point, 6) ?? null);
    }

    const box = hovered ? boundsOf(hovered) : null;

    return (
        <div className="flex w-full flex-col gap-3">
            <div className="relative" onPointerMove={onPointerMove} onPointerLeave={() => setHovered(null)}>
                <div className="[&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: SVG }} />
                {box && (
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}>
                        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke="var(--accent)" strokeDasharray="4 4" />
                        {RESIZE_HANDLES.map((handle) => {
                            const at = handlePoint(box, handle);
                            return <rect key={handle} x={at.x - 4} y={at.y - 4} width={8} height={8} fill="var(--surface)" stroke="var(--accent)" />;
                        })}
                    </svg>
                )}
            </div>
            <p className="font-mono text-code text-text-muted">elementAt: {hovered ? `${hovered.kind} "${hovered.id}"` : 'undefined'}</p>
        </div>
    );
}
