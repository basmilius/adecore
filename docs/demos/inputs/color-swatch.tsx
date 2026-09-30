import { useState } from 'react';
import { ColorSwatch, Tooltip } from '@basmilius/desktop-ui';

const COLORS = [
    { name: 'Blue', color: '#2563eb' },
    { name: 'Violet', color: '#7c3aed' },
    { name: 'Rose', color: '#e11d48' },
    { name: 'Amber', color: '#d97706' },
    { name: 'Green', color: '#16a34a' }
];

export default function ColorSwatchDemo() {
    const [picked, setPicked] = useState<string | null>('Violet');

    return (
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Label color">
            <Tooltip label="No color">
                <ColorSwatch role="radio" aria-checked={picked === null} aria-label="No color" onClick={() => setPicked(null)} />
            </Tooltip>
            {COLORS.map(({ name, color }) => (
                <Tooltip key={name} label={name}>
                    <ColorSwatch
                        role="radio"
                        aria-checked={picked === name}
                        aria-label={name}
                        color={color}
                        picked={picked === name}
                        onClick={() => setPicked(name)}
                    />
                </Tooltip>
            ))}
        </div>
    );
}
