import { useState } from 'react';
import { AccentSwatches } from '@adecore/ui';

type Accent = 'blue' | 'violet' | 'rose' | 'amber' | 'green' | 'teal' | 'slate';

const ACCENTS: { id: Accent; color: string }[] = [
    { id: 'blue', color: '#2563eb' },
    { id: 'violet', color: '#7c3aed' },
    { id: 'rose', color: '#e11d48' },
    { id: 'amber', color: '#d97706' },
    { id: 'green', color: '#16a34a' },
    { id: 'teal', color: '#0d9488' },
    { id: 'slate', color: '#475569' }
];

const NAMES: Record<Accent, string> = {
    blue: 'Blue',
    violet: 'Violet',
    rose: 'Rose',
    amber: 'Amber',
    green: 'Green',
    teal: 'Teal',
    slate: 'Slate'
};

export default function AccentSwatchesDemo() {
    const [accent, setAccent] = useState<Accent>('teal');

    return (
        <AccentSwatches<Accent>
            label="Accent color"
            value={accent}
            onValueChange={setAccent}
            accents={ACCENTS}
            featured={['blue', 'violet', 'rose', 'green']}
            labelOf={(id) => NAMES[id]}
        />
    );
}
