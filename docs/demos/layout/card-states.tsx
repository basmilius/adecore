import { Card, IconButton } from '@adecore/ui';
import { Activity, RotateCcw, Tv } from 'lucide-react';

export default function CardStatesDemo() {
    return (
        <div className="grid w-full max-w-2xl grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <Card.Root>
                <Card.Header title="Event loop" icon={Activity}>
                    <IconButton icon={RotateCcw} label="Reset the peak" size="sm" />
                </Card.Header>
                <Card.Body className="text-xs text-text-muted">Delay p99 4 ms</Card.Body>
            </Card.Root>
            <Card.Root collapsible defaultOpen={false}>
                <Card.Header title="Extra keys" icon={Tv} />
                <Card.Body className="text-xs text-text-muted">Home, menu, volume and the four arrows.</Card.Body>
            </Card.Root>
            <Card.Root>
                <Card.Header title="Last 90 days">99.98% up</Card.Header>
            </Card.Root>
            <Card.Root>
                <Card.Body className="text-xs text-text-muted">No outage in the last 90 days.</Card.Body>
            </Card.Root>
        </div>
    );
}
