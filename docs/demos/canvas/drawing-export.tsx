import { useMemo, useState } from 'react';
import { readingOrder, toSvg } from '@adecore/drawing';
import type { DrawingRoughness } from '@adecore/drawing/protocol';
import { Segmented } from '@adecore/ui';
import { THEME_EDGE, THEME_PALETTE, THEME_PAPER } from '../shared/canvas-theme.ts';
import { SKETCH } from '../shared/sketch.ts';

type Roughness = 'architect' | 'artist' | 'cartoonist';

const ROUGHNESS: Record<Roughness, DrawingRoughness> = { architect: 0, artist: 1, cartoonist: 2 };

export default function DrawingExportDemo() {
    const [roughness, setRoughness] = useState<Roughness>('artist');
    const elements = useMemo(() => SKETCH.map((element) => ({ ...element, roughness: ROUGHNESS[roughness] })), [roughness]);
    const svg = toSvg(elements, { palette: THEME_PALETTE, paper: THEME_PAPER, edge: THEME_EDGE });

    return (
        <div className="flex w-full flex-col gap-4">
            <Segmented<Roughness>
                label="Roughness"
                value={roughness}
                onValueChange={setRoughness}
                options={[
                    { id: 'architect', label: 'Architect' },
                    { id: 'artist', label: 'Artist' },
                    { id: 'cartoonist', label: 'Cartoonist' }
                ]}
                className="self-start"
            />
            <div className="[&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <ol className="flex flex-col gap-1 font-mono text-code text-text-muted">
                {readingOrder(elements).map((line) => (
                    <li key={line}>{line}</li>
                ))}
            </ol>
        </div>
    );
}
