import { useEffect, useState } from 'react';
import { Kbd, formatShortcut, isApplePlatform, matchesShortcut, shortcut, shortcutParts } from '@adecore/ui';

const SAVE = shortcut('Mod+S');

export default function ShortcutsDemo() {
    const [saves, setSaves] = useState(0);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (matchesShortcut(SAVE, event, isApplePlatform())) {
                event.preventDefault();
                setSaves((count) => count + 1);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <div className="flex flex-col items-center gap-2 text-sm text-text">
            <p>
                Press <Kbd shortcut={SAVE} variant="inline" /> on this page. Saved {saves} times.
            </p>
            <p className="text-xs text-text-muted">
                macOS writes it {formatShortcut(SAVE, true)}, everywhere else {formatShortcut(SAVE, false)} ({shortcutParts(SAVE, false).join(' and ')}).
            </p>
        </div>
    );
}
