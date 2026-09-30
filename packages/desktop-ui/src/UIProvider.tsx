import { useLayoutEffect, useState, type ReactNode } from 'react';
import type { i18n as I18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { setFormatSource, type FormatSource } from './format/locale.ts';
import { addUiResources } from './locales.ts';
import { startInputModality } from './modality.ts';
import { TooltipProvider } from './Tooltip.tsx';

export interface UIProviderProps {
    /* The app's i18next instance. The library's `ui` namespace is added to it, in every language it ships. */
    i18n: I18n;
    /* Where the formatters read the language and the region a person set. Without one they write English in the region of that language. */
    formatSource?: FormatSource;
    children: ReactNode;
}

/*
 * Everything the library needs from an app, once, around the whole tree: its words in the app's
 * i18next, the source of the formatters, the shared tooltip delay and the note of which input device
 * is in use. Mount it above the first component of the library.
 */
export function UIProvider({ i18n, formatSource, children }: UIProviderProps) {
    const [handed, setHanded] = useState<{ i18n: I18n | null; source: FormatSource | undefined }>({ i18n: null, source: undefined });
    // In render and not in an effect, so the first child already reads the words and the region.
    // Both calls only store what they are handed, so a render React throws away leaves nothing wrong behind.
    if (handed.i18n !== i18n || handed.source !== formatSource) {
        addUiResources(i18n);
        if (formatSource !== undefined) {
            setFormatSource(formatSource);
        }
        setHanded({ i18n, source: formatSource });
    }

    useLayoutEffect(startInputModality, []);

    return (
        <I18nextProvider i18n={i18n}>
            <TooltipProvider>{children}</TooltipProvider>
        </I18nextProvider>
    );
}
