import { useState } from 'react';
import { Stepper } from '@basmilius/desktop-ui';

export default function StepperDemo() {
    const [size, setSize] = useState(14);
    const [spacing, setSpacing] = useState(1.5);

    return (
        <div className="flex items-center gap-4">
            <Stepper label="Font size" value={size} onValueChange={setSize} min={10} max={24} step={1} unit="px" />
            <Stepper label="Line spacing" value={spacing} onValueChange={setSpacing} min={1} max={2} step={0.25} />
        </div>
    );
}
