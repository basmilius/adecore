import { CircleCheck, Globe, KeyRound, Server } from 'lucide-react';
import { Icon, KeyValueList, Pill } from '@adecore/ui';

export default function KeyValueListRichDemo() {
    return (
        <KeyValueList.Root divided className="w-full max-w-md">
            <KeyValueList.Item>
                <KeyValueList.Name>
                    <Icon icon={Server} size={14} /> Host
                </KeyValueList.Name>
                <KeyValueList.Value mono>smtp.example.com</KeyValueList.Value>
            </KeyValueList.Item>
            <KeyValueList.Item>
                <KeyValueList.Name>
                    <Icon icon={Globe} size={14} /> Port
                </KeyValueList.Name>
                <KeyValueList.Value mono>587</KeyValueList.Value>
            </KeyValueList.Item>
            <KeyValueList.Item>
                <KeyValueList.Name>
                    <Icon icon={KeyRound} size={14} /> Security
                </KeyValueList.Name>
                <KeyValueList.Value>
                    <Icon icon={CircleCheck} size={14} className="text-positive" /> STARTTLS
                </KeyValueList.Value>
            </KeyValueList.Item>
            <KeyValueList.Item>
                <KeyValueList.Name>Tags</KeyValueList.Name>
                <KeyValueList.Value className="flex flex-wrap gap-1">
                    <Pill>billing</Pill>
                    <Pill>autumn</Pill>
                </KeyValueList.Value>
            </KeyValueList.Item>
        </KeyValueList.Root>
    );
}
