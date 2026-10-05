import { KeyValueList } from '@adecore/ui';

const HEADERS: [string, string][] = [
    ['From', 'Billing <billing@example.com>'],
    ['To', 'ada@example.com'],
    ['Subject', 'Your invoice for September'],
    ['Message-ID', '<20261005134412.4f8a2c91e7b3@mail.example.com>'],
    ['DKIM-Signature', 'v=1; a=rsa-sha256; c=relaxed/relaxed; d=example.com; s=mail; h=from:to:subject:date; bh=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='],
    ['X-Mailer-Campaign-Identifier', 'autumn-billing-2026']
];

export default function KeyValueListDividedDemo() {
    return (
        <KeyValueList.Root divided className="w-full max-w-xl">
            {HEADERS.map(([name, value]) => (
                <KeyValueList.Item key={name}>
                    <KeyValueList.Name>{name}</KeyValueList.Name>
                    <KeyValueList.Value mono>{value}</KeyValueList.Value>
                </KeyValueList.Item>
            ))}
        </KeyValueList.Root>
    );
}
