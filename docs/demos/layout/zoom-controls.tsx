import { useState } from 'react';
import { ZoomControls, shortcut } from '@basmilius/desktop-ui';

const SHORTCUTS = { zoomReset: shortcut('Mod+0'), fitAll: shortcut('Mod+1') };

export default function ZoomControlsDemo() {
    const [zoom, setZoom] = useState(1);

    return (
        <ZoomControls
            zoom={zoom}
            onZoomChange={(next) => setZoom(Math.min(4, Math.max(0.1, next)))}
            onFitAll={() => setZoom(0.75)}
            shortcuts={SHORTCUTS}
            selection={{ label: 'Zoom to selection', enabled: false, onZoom: () => {} }}
        />
    );
}
