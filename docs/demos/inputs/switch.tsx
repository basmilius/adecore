import { useState } from 'react';
import { Switch } from '@basmilius/desktop-ui';

export default function SwitchDemo() {
    const [sounds, setSounds] = useState(true);

    return (
        <div className="flex w-72 flex-col gap-3">
            <label className="flex items-center justify-between gap-4 text-sm text-text">
                Play sounds
                <Switch label="Play sounds" checked={sounds} onCheckedChange={setSounds} />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm text-text-muted">
                Sync over cellular
                <Switch label="Sync over cellular" checked={false} onCheckedChange={() => {}} disabled />
            </label>
        </div>
    );
}
