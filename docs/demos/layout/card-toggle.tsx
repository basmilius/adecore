import { Card, KeyValueList, Pill } from '@adecore/ui';
import { Info, Tv } from 'lucide-react';

export default function CardToggleDemo() {
    return (
        <div className="grid w-full max-w-2xl grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <Card.Root collapsible>
                <Card.Header title="Receiver" icon={Info}>
                    <Pill tone="muted">2</Pill>
                </Card.Header>
                <Card.Body>
                    <KeyValueList.Root>
                        <KeyValueList.Item>
                            <KeyValueList.Name>Model</KeyValueList.Name>
                            <KeyValueList.Value>Living room</KeyValueList.Value>
                        </KeyValueList.Item>
                        <KeyValueList.Item>
                            <KeyValueList.Name>Firmware</KeyValueList.Name>
                            <KeyValueList.Value mono>17.4</KeyValueList.Value>
                        </KeyValueList.Item>
                    </KeyValueList.Root>
                </Card.Body>
            </Card.Root>
            <Card.Root collapsible>
                <Card.Header title="Extra keys" icon={Tv} toggle="start">
                    <Pill tone="muted">7</Pill>
                </Card.Header>
                <Card.Body className="text-xs text-text-muted">Home, menu, volume and the four arrows.</Card.Body>
            </Card.Root>
        </div>
    );
}
