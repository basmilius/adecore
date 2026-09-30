import { useState } from 'react';
import { Button, CloseButton, Dialog, PanelHeader, shortcut } from '@basmilius/desktop-ui';

const CLOSE = shortcut('Escape');

export default function CloseButtonDemo() {
    const [open, setOpen] = useState(false);
    const [panel, setPanel] = useState(true);

    return (
        <div className="flex w-80 flex-col gap-4">
            {panel ? (
                <div className="rounded-lg border border-border bg-surface">
                    <PanelHeader title="Outline">
                        <span className="grow" />
                        <CloseButton label="Close outline" size="sm" onClick={() => setPanel(false)} />
                    </PanelHeader>
                    <p className="p-3 text-xs text-text-muted">A panel closes through its own handler.</p>
                </div>
            ) : (
                <Button variant="secondary" onClick={() => setPanel(true)}>
                    Show the panel again
                </Button>
            )}
            <Dialog.Root open={open} onOpenChange={setOpen}>
                <Dialog.Trigger render={<Button variant="secondary" />}>Open a dialog</Dialog.Trigger>
                <Dialog.Popup size="sm">
                    <div className="flex items-start justify-between gap-2">
                        <Dialog.Title>About this file</Dialog.Title>
                        <CloseButton label="Close" kbd={CLOSE} size="sm" className="-mt-1 -mr-2" dialog />
                    </div>
                    <Dialog.Description className="mt-1">In a dialog the button is the dialog's own close part.</Dialog.Description>
                </Dialog.Popup>
            </Dialog.Root>
        </div>
    );
}
