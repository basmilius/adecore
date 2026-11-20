import { Card, CardGrid, KeyValueList, Meter, Pill } from '@adecore/ui';
import { Info, Music, Smartphone, TriangleAlert, Volume2 } from 'lucide-react';

export default function CardGridMasonryDemo() {
    return (
        <CardGrid flow="masonry" className="w-full">
            <Card.Root>
                <Card.Header title="Now playing" icon={Music} />
                <Card.Body className="gap-3 text-xs">
                    <span className="text-text">Weather report, 1:42 of 3:58</span>
                    <Meter label="Playback position" value={43} />
                </Card.Body>
            </Card.Root>
            <Card.Root>
                <Card.Header title="Volume" icon={Volume2}>
                    <Pill tone="muted">absolute</Pill>
                </Card.Header>
                <Card.Body>
                    <Meter label="Volume" value={35} />
                </Card.Body>
            </Card.Root>
            <Card.Root>
                <Card.Header title="Device" icon={Info} />
                <Card.Body>
                    <KeyValueList.Root>
                        <KeyValueList.Item>
                            <KeyValueList.Name>Address</KeyValueList.Name>
                            <KeyValueList.Value mono>192.168.1.42</KeyValueList.Value>
                        </KeyValueList.Item>
                        <KeyValueList.Item>
                            <KeyValueList.Name>Port</KeyValueList.Name>
                            <KeyValueList.Value mono>7000</KeyValueList.Value>
                        </KeyValueList.Item>
                    </KeyValueList.Root>
                </Card.Body>
            </Card.Root>
            <Card.Root>
                <Card.Header title="Recent errors" icon={TriangleAlert} />
                <Card.Body className="text-xs text-text-muted">No errors logged for this device.</Card.Body>
            </Card.Root>
            <Card.Root span="full">
                <Card.Header title="Clients" icon={Smartphone}>
                    <Pill tone="muted" mono>
                        2
                    </Pill>
                </Card.Header>
                <Card.Body className="text-xs text-text-muted">Two apps hold a session with the device.</Card.Body>
            </Card.Root>
        </CardGrid>
    );
}
