import { useState } from 'react';
import { Slider } from '@adecore/ui';

export default function SliderDemo() {
    const [agents, setAgents] = useState(8);
    const [temperature, setTemperature] = useState(0.7);

    return (
        <div className="flex w-72 flex-col gap-4">
            <Slider label="Parallel agents" value={agents} onValueChange={setAgents} min={1} max={16} />
            <Slider label="Temperature" value={temperature} onValueChange={setTemperature} min={0} max={1} step={0.05} decimals={2} />
            <Slider label="Context window" value={200} onValueChange={() => {}} min={50} max={1000} step={50} unit="k" disabled />
        </div>
    );
}
