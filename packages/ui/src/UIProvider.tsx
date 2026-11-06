import type { i18n as I18n } from 'i18next';
import { useLayoutEffect, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { addUiResources } from './locales.ts';
import { startInputModality } from './modality.ts';
import { startSyncedAnimations } from './synced-animations.ts';
import { TooltipProvider } from './Tooltip.tsx';

export interface UIProviderProps {
    /* The library's `ui` namespace is added to it, in every language it ships. */
    i18n: I18n;

    children: ReactNode;
}

export function UIProvider({ i18n, children }: UIProviderProps) {
    const [handed, setHanded] = useState<I18n | null>(null);

    // In render and not in an effect, so the first child already reads the words.
    // The call only stores what it is handed, so a render React throws away leaves nothing wrong behind.
    if (handed !== i18n) {
        addUiResources(i18n);
        setHanded(i18n);
    }

    useLayoutEffect(startInputModality, []);
    useLayoutEffect(startSyncedAnimations, []);

    return (
        <I18nextProvider i18n={i18n}>
            <TooltipProvider>{children}</TooltipProvider>
        </I18nextProvider>
    );
}
