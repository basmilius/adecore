import { useRef, useState } from 'react';
import { ColumnResizeHandle, useColumnResize } from '@basmilius/desktop-ui';

export default function ColumnResizeHandleDemo() {
    const column = useRef<HTMLElement>(null);
    const [width, setWidth] = useState(220);
    const { startResize } = useColumnResize(column, { size: width, min: 160, max: () => 400, from: 'left', onSize: setWidth });

    return (
        <div className="flex h-56 w-full overflow-hidden rounded-lg border border-border bg-bg">
            <aside ref={column} className="relative shrink-0 border-r border-border bg-surface p-3 text-xs text-text-muted" style={{ width }}>
                Drag my right edge: {width} pixels.
                <ColumnResizeHandle from="left" onPointerDown={startResize} />
            </aside>
            <div className="grow p-3 text-xs text-text-faint">The rest of the view.</div>
        </div>
    );
}
