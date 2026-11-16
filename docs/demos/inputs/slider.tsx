import { Slider } from '@adecore/ui';
import { useState } from 'react';

export default function SliderDemo() {
    const [agents, setAgents] = useState(8);
    const [temperature, setTemperature] = useState(0.7);
    const [volume, setVolume] = useState(40);
    const [sent, setSent] = useState(40);

    return (
        <div className="flex w-72 flex-col gap-4">
            <Slider label="Parallel agents" value={agents} onValueChange={setAgents} min={1} max={16} />
            <Slider label="Temperature" value={temperature} onValueChange={setTemperature} min={0} max={1} step={0.05} decimals={2} />
            <Slider label="Volume" value={volume} onValueChange={setVolume} onValueCommitted={setSent} min={0} max={100} unit="%" heading={false} />
            <span className="text-xs text-text-muted">Sent to the speaker: {sent}%</span>
            <Slider label="Context window" value={200} onValueChange={() => {}} min={50} max={1000} step={50} unit="k" disabled />
        </div>
    );
}
