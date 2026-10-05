import { useRef, useState } from 'react';
import { ColumnResizeHandle, clampColumnSize, useColumnResize } from '@adecore/ui';

const BOUNDS = { min: 48, max: () => 176 };

export default function UseColumnResizeDemo() {
    const row = useRef<HTMLElement>(null);
    const [height, setHeight] = useState(() => clampColumnSize(BOUNDS, 400));
    const { startResize } = useColumnResize(row, { ...BOUNDS, size: height, from: 'bottom', onSize: setHeight });

    return (
        <div className="flex h-56 w-full flex-col overflow-hidden rounded-lg border border-border bg-bg">
            <div className="grow p-3 text-xs text-text-faint">The rest of the view.</div>
            <section ref={row} className="relative shrink-0 border-t border-border bg-surface p-3 text-xs text-text-muted" style={{ height }}>
                A row pinned to the bottom. Drag its top edge: {height} pixels.
                <ColumnResizeHandle from="bottom" onPointerDown={startResize} />
            </section>
        </div>
    );
}
