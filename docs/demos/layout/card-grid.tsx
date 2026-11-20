import { Card, CardGrid, Meter } from '@adecore/ui';

const APPS = [
    { name: 'Desktop', count: 31 },
    { name: 'Phone', count: 12 },
    { name: 'Daemon', count: 5 }
];

export default function CardGridDemo() {
    return (
        <CardGrid columns={3} className="w-full">
            <Card.Root span={2}>
                <Card.Header title="Error events per day">
                    <a href="#issues" className="hover:text-text">
                        View issues
                    </a>
                </Card.Header>
                <Card.Body>
                    <div className="min-h-24 grow rounded-md bg-surface-sunken" />
                </Card.Body>
            </Card.Root>
            <Card.Root>
                <Card.Header title="Open issues by app" />
                <Card.Body className="gap-2 text-xs">
                    {APPS.map((app) => (
                        <div key={app.name} className="flex items-center gap-2">
                            <span className="w-16 text-text">{app.name}</span>
                            <Meter label={`Open issues in ${app.name}`} value={app.count} max={31} className="grow" />
                        </div>
                    ))}
                </Card.Body>
                <Card.Footer>48 open</Card.Footer>
            </Card.Root>
            <Card.Root span="full">
                <Card.Body className="text-xs text-text">This outage opened three issues.</Card.Body>
            </Card.Root>
        </CardGrid>
    );
}
