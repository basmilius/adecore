import { Button, Toasts, createToastStore } from '@adecore/ui';

const toasts = createToastStore();

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function push(): Promise<void> {
    const id = toasts.getState().show({ kind: 'progress', title: 'Pushing to origin' });
    await wait(1500);
    toasts.getState().update(id, { kind: 'success', title: 'Pushed to origin', description: '3 commits' });
}

async function sync(): Promise<void> {
    const total = 120;
    const id = toasts.getState().show({ kind: 'progress', title: 'Syncing mail', progress: 0 });

    for (let done = 0; done < total; done += 20) {
        toasts.getState().update(id, { description: `${done} of ${total} messages`, progress: done / total });
        await wait(300);
    }

    toasts.getState().update(id, { kind: 'success', title: 'Mail up to date', description: undefined, progress: undefined });
}

function fail(): void {
    const id = toasts.getState().show({
        kind: 'error',
        title: 'Could not fetch',
        description: 'The remote did not answer within 30 seconds.',
        actions: [
            { label: 'Show log', run: () => toasts.getState().dismiss(id) },
            { label: 'Try again', run: () => toasts.getState().dismiss(id) }
        ]
    });
}

function remove(): void {
    const id = toasts.getState().show({
        kind: 'deleted',
        title: 'Moved "notes.md" to the trash',
        action: { label: 'Undo', run: () => toasts.getState().dismiss(id) }
    });
}

export default function ToastsDemo() {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => void push()}>
                Push
            </Button>
            <Button variant="secondary" onClick={() => void sync()}>
                Sync
            </Button>
            <Button variant="secondary" onClick={fail}>
                Fetch
            </Button>
            <Button variant="secondary" onClick={remove}>
                Delete a file
            </Button>
            <Toasts store={toasts} />
        </div>
    );
}
