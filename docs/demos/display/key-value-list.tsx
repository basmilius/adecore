import { KeyValueList } from '@adecore/ui';

export default function KeyValueListDemo() {
    return (
        <KeyValueList.Root className="w-full max-w-sm">
            <KeyValueList.Item>
                <KeyValueList.Name>Length</KeyValueList.Name>
                <KeyValueList.Value>3 min 45 s</KeyValueList.Value>
            </KeyValueList.Item>
            <KeyValueList.Item>
                <KeyValueList.Name>Tempo</KeyValueList.Name>
                <KeyValueList.Value>118 BPM</KeyValueList.Value>
            </KeyValueList.Item>
            <KeyValueList.Item>
                <KeyValueList.Name>Mood</KeyValueList.Name>
                <KeyValueList.Value>Warm, unhurried, with a lift in the last chorus</KeyValueList.Value>
            </KeyValueList.Item>
        </KeyValueList.Root>
    );
}
