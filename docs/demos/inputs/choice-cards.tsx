import { useState } from 'react';
import { Cloud, HardDrive } from 'lucide-react';
import { ChoiceCards } from '@basmilius/react-ui';

type Storage = 'local' | 'cloud';

export default function ChoiceCardsDemo() {
    const [storage, setStorage] = useState<Storage>('local');

    return (
        <ChoiceCards<Storage>
            label="Where to keep the project"
            className="w-full max-w-xl"
            value={storage}
            onValueChange={setStorage}
            choices={[
                { value: 'local', title: 'On this computer', description: 'Fast, and only here.', icon: HardDrive },
                { value: 'cloud', title: 'In your account', description: 'On every device you sign in on.', icon: Cloud }
            ]}
        />
    );
}
