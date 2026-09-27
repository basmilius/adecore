import { Suspense, useState } from 'react';
import { Button, lazyNamed, prefetcher } from '@basmilius/react-ui';

// A module the app splits off, loaded on its first use.
const Chart = lazyNamed(() => import('../shared/lazy-chart.tsx'), 'LazyChart');

export default function LazyLoadingDemo() {
    const [shown, setShown] = useState(false);

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShown(!shown)}>
                    {shown ? 'Hide the chart' : 'Show the chart'}
                </Button>
                <Button onClick={() => void prefetcher.prefetchEverything()}>Prefetch everything</Button>
            </div>
            {shown && (
                <Suspense fallback={<p className="text-xs text-text-muted">Loading...</p>}>
                    <Chart bars={[4, 7, 3, 9, 6]} />
                </Suspense>
            )}
        </div>
    );
}
