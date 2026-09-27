import { useState } from 'react';
import { GitBranch } from 'lucide-react';
import { Button, PromptDialog } from '@basmilius/react-ui';

const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

export default function PromptDialogDemo() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('main');

    return (
        <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setOpen(true)}>
                Rename {name}
            </Button>
            <PromptDialog
                open={open}
                onOpenChange={setOpen}
                title="Rename the branch"
                titleIcon={GitBranch}
                description="Pushes under the new name the next time you push."
                field={{ label: 'New name', initial: name, mono: true, maxLength: 60 }}
                confirmLabel="Rename"
                confirmBusyLabel="Renaming..."
                onConfirm={async (value) => {
                    await wait(800);
                    if (value === 'HEAD') {
                        throw new Error('HEAD is not a valid branch name.');
                    }
                    setName(value);
                    setOpen(false);
                }}
            />
        </div>
    );
}
