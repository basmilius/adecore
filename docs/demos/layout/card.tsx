import { Card, KeyValueList, Pill } from '@adecore/ui';
import { Info } from 'lucide-react';

export default function CardDemo() {
    return (
        <Card.Root className="w-full max-w-sm">
            <Card.Header title="Device" icon={Info}>
                <Pill tone="muted">paired</Pill>
            </Card.Header>
            <Card.Body>
                <KeyValueList.Root divided>
                    <KeyValueList.Item>
                        <KeyValueList.Name>Identifier</KeyValueList.Name>
                        <KeyValueList.Value mono>AA:BB:CC:DD:EE:FF</KeyValueList.Value>
                    </KeyValueList.Item>
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
    );
}
