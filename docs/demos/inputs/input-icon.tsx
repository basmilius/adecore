import { Folder, Search } from 'lucide-react';
import { Button, Field, Input } from '@basmilius/desktop-ui';

export default function InputIconDemo() {
    return (
        <div className="flex w-80 flex-col gap-4">
            <Input icon={Search} aria-label="Search" placeholder="Search" />
            <Input icon={Search} size="sm" aria-label="Filter files" placeholder="Filter files" />
            <Field label="Folder">
                <div className="flex items-center gap-2">
                    <Input icon={Folder} readOnly value="~/Projects/launch-video" placeholder="No folder chosen" />
                    <Button variant="secondary">Choose</Button>
                </div>
            </Field>
        </div>
    );
}
