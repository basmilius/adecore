import { useState } from 'react';
import { Field, FieldHint, FormError, Input, Segmented } from '@basmilius/react-ui';

export default function FieldDemo() {
    const [name, setName] = useState('feature/export');
    const taken = name.trim() === 'main';
    const [ground, setGround] = useState('dark');

    return (
        <div className="flex w-80 flex-col gap-4">
            <Field label="Branch name" hint="Lowercase, with slashes for a folder." error={taken ? 'A branch called main already exists.' : null}>
                <Input mono value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field group label="Ground" hint="What every frame is drawn on.">
                <Segmented
                    label="Ground"
                    value={ground}
                    onValueChange={setGround}
                    options={[
                        { id: 'dark', label: 'Dark' },
                        { id: 'light', label: 'Light' }
                    ]}
                />
            </Field>
            <div>
                <Input aria-label="Remote URL" placeholder="https://" />
                <FieldHint>A hint on its own keeps a margin above it.</FieldHint>
            </div>
            <FormError>The remote refused the push.</FormError>
        </div>
    );
}
