export interface VisualViewportGeometry {
    height: number;
    top: number;
}

export function visualViewportGeometry(contentHeight: number, availableHeight: number, top: number): VisualViewportGeometry {
    const height = Math.max(1, Math.min(contentHeight, availableHeight));
    return { height, top: Math.max(0, Math.min(-top, contentHeight - height)) };
}
