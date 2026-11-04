import { ScrollArea } from '@adecore/ui';
import type { ReactNode } from 'react';

/* The box around a table of values: a frame that scrolls while it is shown, out of sight but still read while it is not. */
export function ValuesBox({ id, shown, children }: { id: string; shown: boolean; children: ReactNode }) {
    if (!shown) {
        return (
            <div id={id} className="sr-only">
                {children}
            </div>
        );
    }

    return (
        <ScrollArea axis="both" id={id} className="max-h-80 w-full rounded-md border border-border-soft">
            {children}
        </ScrollArea>
    );
}
