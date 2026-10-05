import { useState } from 'react';
import { Button } from '@adecore/ui';
import { ConfirmDialog } from '@adecore/ui/settings';

const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

export default function ConfirmDialogDemo() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button variant="danger-outline" onClick={() => setOpen(true)}>
                Sign out everywhere
            </Button>
            <ConfirmDialog
                open={open}
                onOpenChange={setOpen}
                title="Sign out on every device?"
                description="Each device asks for your password again the next time it opens."
                confirmLabel="Sign out"
                onConfirm={() => wait(800)}
            />
        </>
    );
}
