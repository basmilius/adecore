import type { ReactNode } from 'react';
import i18next from 'i18next';
import { Dialog } from '@adecore/ui';

/*
 * The frame of the usage page, wider than the settings for the chart and the breakdown. What goes in
 * it mounts only while it is open, so nothing is scanned behind a closed dialog.
 */
export function UsageDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange(open: boolean): void; children: ReactNode }) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Popup className="flex h-[820px] w-[1080px] flex-col">
                {children}
                <Dialog.Description className="sr-only">{i18next.t('agent-usage:dialog.description')}</Dialog.Description>
            </Dialog.Popup>
        </Dialog.Root>
    );
}
