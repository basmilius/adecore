import { Select } from '@adecore/ui';
import { Play } from 'lucide-react';
import { useState } from 'react';

const VOICES = ['Bar', 'Glass', 'Wood'];

export default function SelectActionDemo() {
    const [voice, setVoice] = useState('bar');
    const [tried, setTried] = useState<string | null>(null);

    return (
        <div className="flex flex-wrap items-center gap-3">
            <Select
                label="Voice"
                value={voice}
                onValueChange={setVoice}
                items={VOICES.map((name) => ({
                    value: name.toLowerCase(),
                    label: name,
                    action: {
                        icon: Play,
                        label: `Play ${name}`,
                        run: () => setTried(name)
                    }
                }))}
            />
            <span className="text-xs text-text-muted">{tried === null ? 'Nothing played yet' : `Played ${tried}`}</span>
        </div>
    );
}
