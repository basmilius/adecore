import { TokenInput, type TokenInputToken } from '@adecore/ui';
import { useState } from 'react';

const ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function TokenInputDemo() {
    const [recipients, setRecipients] = useState<TokenInputToken[]>([
        { key: 'sanne@example.com', label: 'Sanne de Vries' },
        { key: 'jan@example.com', label: 'Jan Dekker' }
    ]);
    const [text, setText] = useState('');

    const add = (value: string): void => {
        const address = value.trim();

        setRecipients((current) =>
            current.some((token) => token.key === address) ? current : [...current, { key: address, label: address, invalid: !ADDRESS.test(address) }]
        );
        setText('');
    };

    return (
        <div className="w-96">
            <TokenInput
                label="To"
                placeholder="Name or address"
                tokens={recipients}
                value={text}
                onValueChange={setText}
                onCommit={add}
                onRemove={(key) => setRecipients((current) => current.filter((token) => token.key !== key))}
            />
        </div>
    );
}
