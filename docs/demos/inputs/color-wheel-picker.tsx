import { useState } from 'react';
import { ColorWheelPicker, Select } from '@adecore/ui';

type Tint = 'default' | 'red' | 'orange' | 'amber' | 'lime' | 'green' | 'teal' | 'sky' | 'blue' | 'violet' | 'pink' | 'slate' | 'stone' | 'olive';

const COLORS: Record<Tint, [lighter: string, color: string]> = {
    default: ['#d4d4d4', '#737373'],
    red: ['#fca5a5', '#ef4444'],
    orange: ['#fdba74', '#f97316'],
    amber: ['#fcd34d', '#f59e0b'],
    lime: ['#bef264', '#84cc16'],
    green: ['#86efac', '#22c55e'],
    teal: ['#5eead4', '#14b8a6'],
    sky: ['#7dd3fc', '#0ea5e9'],
    blue: ['#93c5fd', '#3b82f6'],
    violet: ['#c4b5fd', '#8b5cf6'],
    pink: ['#f9a8d4', '#ec4899'],
    slate: ['#cbd5e1', '#64748b'],
    stone: ['#d6d3d1', '#78716c'],
    olive: ['#d8d8c0', '#7c7c5c']
};

const HUES: Tint[] = ['red', 'orange', 'amber', 'lime', 'green', 'teal', 'sky', 'blue', 'violet', 'pink'];
const NEUTRALS: Tint[] = ['slate', 'stone', 'olive'];

const nameOf = (id: Tint): string => id.charAt(0).toUpperCase() + id.slice(1);

/* Two tones on one swatch: the lighter step under the color, split along the diagonal. */
const swatchOf = (id: Tint): string => `linear-gradient(135deg, ${COLORS[id][0]} 50%, ${COLORS[id][1]} 50%)`;

export default function ColorWheelPickerDemo() {
    const [tint, setTint] = useState<Tint>('default');
    const [preview, setPreview] = useState<Tint | null>(null);
    const [density, setDensity] = useState('comfortable');
    const shown = preview ?? tint;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
                <ColorWheelPicker<Tint>
                    label="Tint"
                    value={tint}
                    onValueChange={setTint}
                    onPreviewChange={setPreview}
                    rings={[HUES, NEUTRALS]}
                    center="default"
                    colorOf={swatchOf}
                    labelOf={nameOf}
                />
                <Select
                    label="Density"
                    value={density}
                    onValueChange={setDensity}
                    items={[
                        { value: 'comfortable', label: 'Comfortable' },
                        { value: 'compact', label: 'Compact' }
                    ]}
                />
            </div>
            <div className="h-10 rounded-lg border border-border" style={{ background: COLORS[shown][0] }} />
        </div>
    );
}
