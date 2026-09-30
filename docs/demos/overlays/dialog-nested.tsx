import { Button, Dialog } from '@basmilius/desktop-ui';

export default function DialogNested() {
    return (
        <Dialog.Root>
            <Dialog.Trigger render={<Button variant="secondary" />}>Edit profile</Dialog.Trigger>
            <Dialog.Popup className="w-[480px] p-5">
                <Dialog.Title size="lg">Profile</Dialog.Title>
                <Dialog.Description className="mt-1">A dialog opened from inside another one stacks over it and dims it.</Dialog.Description>
                <Dialog.Footer>
                    <Dialog.Root>
                        <Dialog.Trigger render={<Button variant="danger-outline" />}>Delete account</Dialog.Trigger>
                        <Dialog.Popup size="sm">
                            <Dialog.Title>Delete the account?</Dialog.Title>
                            <Dialog.Description className="mt-1">Everything in it goes with it.</Dialog.Description>
                            <Dialog.Footer>
                                <Dialog.Close render={<Button />}>Keep it</Dialog.Close>
                                <Dialog.Close render={<Button variant="danger" />}>Delete</Dialog.Close>
                            </Dialog.Footer>
                        </Dialog.Popup>
                    </Dialog.Root>
                    <Dialog.Close render={<Button variant="primary" />}>Done</Dialog.Close>
                </Dialog.Footer>
            </Dialog.Popup>
        </Dialog.Root>
    );
}
