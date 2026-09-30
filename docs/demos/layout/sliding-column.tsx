import { useState } from 'react';
import { PanelRight } from 'lucide-react';
import { CloseButton, IconButton, PanelHeader, SlidingColumn } from '@basmilius/desktop-ui';

const BOUNDS = { min: 200, max: () => 360 };

export default function SlidingColumnDemo() {
    const [open, setOpen] = useState(true);
    const [width, setWidth] = useState(260);

    return (
        <div className="flex h-72 w-full overflow-hidden rounded-lg border border-border bg-bg">
            <div className="flex grow items-start justify-end p-2">
                <IconButton icon={PanelRight} label={open ? 'Hide details' : 'Show details'} active={open} onClick={() => setOpen(!open)} />
            </div>
            <SlidingColumn open={open} width={width} bounds={BOUNDS} onWidthChange={setWidth}>
                <PanelHeader title="Details">
                    <span className="grow" />
                    <CloseButton label="Close details" size="sm" onClick={() => setOpen(false)} />
                </PanelHeader>
                <p className="p-3 text-xs text-text-muted">Drag the left edge. The column is {width} pixels wide.</p>
            </SlidingColumn>
        </div>
    );
}
