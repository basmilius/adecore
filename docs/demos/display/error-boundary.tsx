import { useState } from 'react';
import { Button, ErrorBoundary } from '@adecore/ui';

function Chart({ broken }: { broken: boolean }) {
    if (broken) {
        throw new Error('Cannot read the series "memory" of an empty sample.');
    }
    return <div className="grid h-full place-items-center text-xs text-text-muted">The chart draws here.</div>;
}

export default function ErrorBoundaryDemo() {
    const [broken, setBroken] = useState(false);

    return (
        <div className="flex w-full max-w-md flex-col items-center gap-3">
            <div className="relative h-56 w-full overflow-hidden rounded-lg border border-border bg-surface">
                <ErrorBoundary label="This chart failed to render" resetKeys={[broken]}>
                    <Chart broken={broken} />
                </ErrorBoundary>
            </div>
            <Button variant="secondary" onClick={() => setBroken(!broken)}>
                {broken ? 'Fix the data' : 'Break the chart'}
            </Button>
        </div>
    );
}
