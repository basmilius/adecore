import { useState } from 'react';
import { useContentSize, useMeasuredWidth } from '@adecore/ui';

export default function UseContentSizeDemo() {
    const [measure, size] = useContentSize();
    const [measureWidth, width] = useMeasuredWidth();
    const [wide, setWide] = useState(false);

    return (
        <div className="flex w-full flex-col items-center gap-3">
            <div
                ref={measure}
                className="grid h-24 place-items-center rounded-lg border border-dashed border-border-strong text-xs text-text-muted"
                style={{ width: wide ? '100%' : '50%' }}
            >
                {size.width} by {size.height}
            </div>
            <div ref={measureWidth} className="h-2 w-3/4 rounded-full bg-accent-soft">
                <div className="h-2 rounded-full bg-accent" style={{ width: Math.round(width * 0.4) }} />
            </div>
            <button type="button" className="focus-ring rounded-md text-xs text-accent" onClick={() => setWide(!wide)}>
                {wide ? 'Narrow the box' : 'Widen the box'}
            </button>
        </div>
    );
}
