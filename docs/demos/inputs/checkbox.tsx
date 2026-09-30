import { useState } from 'react';
import { Checkbox } from '@basmilius/desktop-ui';

const SCRIPTS = ['dev', 'build', 'check', 'preview'];

export default function CheckboxDemo() {
    const [picked, setPicked] = useState<string[]>(['dev', 'build']);
    const all = picked.length === SCRIPTS.length;

    const toggle = (script: string, checked: boolean) => {
        setPicked((current) => (checked ? [...current, script] : current.filter((candidate) => candidate !== script)));
    };

    return (
        <div className="flex w-72 flex-col gap-2 text-sm text-text">
            <label className="flex items-center gap-2 font-medium">
                <Checkbox
                    label="Every script"
                    checked={all}
                    indeterminate={!all && picked.length > 0}
                    onCheckedChange={(checked) => setPicked(checked ? SCRIPTS : [])}
                />
                Every script
            </label>
            {SCRIPTS.map((script) => (
                <label key={script} className="flex items-center gap-2 pl-6">
                    <Checkbox label={script} checked={picked.includes(script)} onCheckedChange={(checked) => toggle(script, checked)} />
                    {script}
                </label>
            ))}
            <label className="flex items-center gap-2 pl-6 text-text-muted">
                <Checkbox label="test" checked={false} onCheckedChange={() => {}} disabled />
                test
            </label>
        </div>
    );
}
