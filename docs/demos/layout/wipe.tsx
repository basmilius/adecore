import { useState } from 'react';
import { Wipe } from '@adecore/ui';

function Frame({ label, className }: { label: string; className: string }) {
    return (
        <div className={`grid h-full w-full place-items-center text-sm font-medium ${className}`}>
            <span className="rounded-md bg-surface/80 px-2 py-1 text-text">{label}</span>
        </div>
    );
}

export default function WipeDemo() {
    const [split, setSplit] = useState(0.5);

    return (
        <div className="relative h-64 w-full max-w-xl overflow-hidden rounded-lg">
            <Wipe
                label="Compare the two renders"
                value={split}
                onValueChange={setSplit}
                before={<Frame label="Before" className="bg-surface-sunken" />}
                after={<Frame label="After" className="bg-accent-soft" />}
            />
        </div>
    );
}
