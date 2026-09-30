import { Kbd, KeyCap, Keys, shortcut } from '@basmilius/desktop-ui';

const PALETTE = shortcut('Mod+Shift+P');
const PAN = shortcut('Mod');

export default function KbdDemo() {
    return (
        <div className="flex flex-col items-center gap-4 text-xs text-text-muted">
            <p>
                Open the palette with <Kbd shortcut={PALETTE} variant="inline" />, close it with <Kbd variant="inline">Esc</Kbd>.
            </p>
            <div className="flex items-center gap-6">
                <Keys shortcut={PALETTE} />
                <Keys shortcut={PAN} then="drag" />
                <KeyCap>↑</KeyCap>
            </div>
        </div>
    );
}
