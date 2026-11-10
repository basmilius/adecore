import { Segmented, setWindowControlsSource, WindowControlsSpacer } from '@adecore/ui';
import { useEffect, useState } from 'react';

type Window = 'controls' | 'fullscreen';

const listeners = new Set<() => void>();
let inset: number | null = 86;

const show = (window: Window): void => {
    inset = window === 'controls' ? 86 : null;
    listeners.forEach((listener) => listener());
};

const source = {
    inset: () => inset,
    subscribe: (onChange: () => void) => {
        listeners.add(onChange);

        return () => void listeners.delete(onChange);
    }
};

export default function WindowControlsSpacerDemo() {
    const [window, setWindow] = useState<Window>('controls');
    // An app sets its source before the first render; the demo does so before its own, and puts the page's back after.
    const [previous] = useState(() => setWindowControlsSource(source));

    useEffect(() => () => void setWindowControlsSource(previous), [previous]);

    return (
        <div className="flex w-full max-w-md flex-col gap-3">
            <div className="relative flex h-12 items-center gap-2 rounded-lg border border-border bg-surface pr-3">
                {window === 'controls' && (
                    <span aria-hidden className="pointer-events-none absolute top-1/2 left-4 flex -translate-y-1/2 gap-2">
                        <span className="size-3 rounded-full bg-text/20" />
                        <span className="size-3 rounded-full bg-text/20" />
                        <span className="size-3 rounded-full bg-text/20" />
                    </span>
                )}
                <WindowControlsSpacer />
                <span className="pl-3 text-sm font-semibold">Inbox</span>
            </div>
            <Segmented
                label="Window"
                value={window}
                onValueChange={(next) => {
                    setWindow(next);
                    show(next);
                }}
                options={[
                    { id: 'controls', label: 'With controls' },
                    { id: 'fullscreen', label: 'Fullscreen' }
                ]}
            />
        </div>
    );
}
