import { useState } from 'react';
import { Button, Dialog } from '@adecore/ui';

export default function DialogDemo() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger render={<Button variant="danger-outline" />}>Remove branch</Dialog.Trigger>
            <Dialog.Popup size="sm">
                <Dialog.Title>Remove the branch?</Dialog.Title>
                <Dialog.Description className="mt-1">It has two commits nothing else has.</Dialog.Description>
                <Dialog.Text size="xs" className="mt-2">
                    A removed branch can be restored from the reflog for 90 days.
                </Dialog.Text>
                <Dialog.Footer>
                    <Dialog.Close render={<Button />}>Cancel</Dialog.Close>
                    <Button variant="danger" onClick={() => setOpen(false)}>
                        Remove
                    </Button>
                </Dialog.Footer>
            </Dialog.Popup>
        </Dialog.Root>
    );
}
