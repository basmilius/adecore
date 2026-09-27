import { useState } from 'react';
import { Button, useNow, useTickingText } from '@basmilius/react-ui';
import { formatClockDuration, formatElapsedShort } from '@basmilius/react-ui/format';

export default function UseNowDemo() {
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const now = useNow(1000, startedAt !== null);
    const [mountedAt] = useState(Date.now);
    const ticking = useTickingText(() => formatClockDuration(Date.now() - mountedAt));

    return (
        <div className="flex flex-col items-center gap-3 text-sm text-text">
            <p className="tabular-nums">{startedAt === null ? 'Not running' : `Running for ${formatElapsedShort(now - startedAt)}`}</p>
            <Button variant="secondary" onClick={() => setStartedAt(startedAt === null ? Date.now() : null)}>
                {startedAt === null ? 'Start' : 'Stop'}
            </Button>
            <p className="text-xs text-text-muted">
                On this page for <span ref={ticking} className="tabular-nums" />
            </p>
        </div>
    );
}
