import { Banner, Card, CardGrid } from '@adecore/ui';
import { ListMusic, Settings2, Shuffle, Tv, Unplug } from 'lucide-react';

export default function CardGridGroupsDemo() {
    return (
        <CardGrid columns={1} className="w-full">
            <Banner placement="inline" icon={Unplug} tone="attention" message="Not connected. The controls below wait for the device." />
            <CardGrid flow="masonry">
                <Card.Root>
                    <Card.Header title="Transport" />
                    <Card.Body className="text-xs text-text-muted">Play, pause and skip.</Card.Body>
                </Card.Root>
                <Card.Root>
                    <Card.Header title="Volume" />
                    <Card.Body className="text-xs text-text-muted">35%</Card.Body>
                </Card.Root>
            </CardGrid>
            <CardGrid title="Modes and queue" icon={ListMusic} flow="masonry">
                <Card.Root>
                    <Card.Header title="Modes" icon={Shuffle} />
                    <Card.Body className="text-xs text-text-muted">Shuffle off, repeat all.</Card.Body>
                </Card.Root>
                <Card.Root>
                    <Card.Header title="Queue" />
                    <Card.Body className="text-xs text-text-muted">Four items after this one.</Card.Body>
                </Card.Root>
                <CardGrid title="Advanced" icon={Settings2} flow="masonry">
                    <Card.Root collapsible defaultOpen={false}>
                        <Card.Header title="Extra keys" icon={Tv} />
                        <Card.Body className="text-xs text-text-muted">Home, menu and the four arrows.</Card.Body>
                    </Card.Root>
                </CardGrid>
            </CardGrid>
        </CardGrid>
    );
}
