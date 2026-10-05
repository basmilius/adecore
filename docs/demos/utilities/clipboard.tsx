import { useRef, useState } from 'react';
import { Button, copyText, readClipboardText, selectAllWithin, selectionWithin } from '@adecore/ui';

export default function ClipboardDemo() {
    const block = useRef<HTMLParagraphElement>(null);
    const [read, setRead] = useState('');

    return (
        <div className="flex w-full max-w-md flex-col gap-3">
            <p ref={block} className="rounded-lg border border-border bg-surface p-3 font-mono text-code text-text select-text">
                git remote add origin git@github.com:basmilius/adecore.git
            </p>
            <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => selectAllWithin(block.current)}>
                    Select all
                </Button>
                <Button variant="secondary" size="sm" onClick={() => copyText(selectionWithin(block.current) || block.current?.textContent || '')}>
                    Copy
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void readClipboardText().then(setRead)}>
                    Read the clipboard
                </Button>
            </div>
            {read !== '' && <p className="text-xs text-text-muted">The clipboard holds: {read}</p>}
        </div>
    );
}
