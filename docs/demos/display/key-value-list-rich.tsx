import { Icon, KeyValueList, Pill } from '@adecore/ui';
import { CircleCheck, Globe, KeyRound, Server } from 'lucide-react';

export default function KeyValueListRichDemo() {
    return (
        <KeyValueList.Root divided className="w-full max-w-md">
            <KeyValueList.Item>
                <KeyValueList.Name icon={Server}>Host</KeyValueList.Name>
                <KeyValueList.Value mono>smtp.example.com</KeyValueList.Value>
            </KeyValueList.Item>
            <KeyValueList.Item>
                <KeyValueList.Name icon={Globe}>Port</KeyValueList.Name>
                <KeyValueList.Value mono>587</KeyValueList.Value>
            </KeyValueList.Item>
            <KeyValueList.Item>
                <KeyValueList.Name icon={KeyRound}>Security</KeyValueList.Name>
                <KeyValueList.Value>
                    <span className="inline-flex items-center gap-1.5">
                        <Icon icon={CircleCheck} size={14} className="text-positive" />
                        STARTTLS
                    </span>
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
