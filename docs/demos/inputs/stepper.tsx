import { useState } from 'react';
import { Stepper } from '@basmilius/desktop-ui';

export default function StepperDemo() {
    const [size, setSize] = useState(14);
    const [lineHeight, setLineHeight] = useState(1.5);
    const [speed, setSpeed] = useState(1.25);

    return (
        <div className="flex items-center gap-4">
            <Stepper label="Font size" value={size} onValueChange={setSize} min={10} max={24} step={1} unit="px" />
            <Stepper label="Line height" value={lineHeight} onValueChange={setLineHeight} min={1} max={2.5} step={0.1} unit="×" />
            <Stepper label="Playback speed" value={speed} onValueChange={setSpeed} min={0.25} max={2} step={0.25} unit="×" />
        </div>
    );
}
