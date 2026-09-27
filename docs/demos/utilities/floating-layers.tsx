import { useState, type PointerEvent } from 'react';
import { Button, Menu, isInFloatingLayer } from '@basmilius/react-ui';

export default function FloatingLayersDemo() {
    const [clicks, setClicks] = useState(0);

    const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
        // A popup is portaled out of this box, yet its events still bubble here through React.
        if (isInFloatingLayer(event.target)) {
            return;
        }
        setClicks((count) => count + 1);
    };

    return (
        <div onPointerDown={onPointerDown} className="grid h-44 w-full max-w-md place-items-center rounded-lg border border-dashed border-border-strong">
            <div className="flex flex-col items-center gap-2 text-xs text-text-muted">
                The canvas took {clicks} clicks.
                <Menu.Root>
                    <Menu.Trigger render={<Button variant="secondary" size="sm" />}>Open a menu</Menu.Trigger>
                    <Menu.Popup>
                        <Menu.Item>A click in here is not the canvas's</Menu.Item>
                    </Menu.Popup>
                </Menu.Root>
            </div>
        </div>
    );
}
