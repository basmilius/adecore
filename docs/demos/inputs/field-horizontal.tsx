import { useState } from 'react';
import { Field, Input, Segmented, TextArea } from '@basmilius/react-ui';

export default function FieldHorizontalDemo() {
    const [kind, setKind] = useState('service');

    return (
        <div className="flex w-120 flex-col gap-3">
            <Field orientation="horizontal" label="Name">
                <Input defaultValue="Run server" />
            </Field>
            <Field orientation="horizontal" group label="Kind" hint="Keeps running until you stop it.">
                <Segmented
                    label="Kind"
                    value={kind}
                    onValueChange={setKind}
                    options={[
                        { id: 'service', label: 'Service' },
                        { id: 'task', label: 'Task' }
                    ]}
                />
            </Field>
            <Field orientation="horizontal" label="Command">
                <TextArea rows={2} mono defaultValue="php -S 0.0.0.0:8000 -t public dev/server.php" />
            </Field>
        </div>
    );
}
