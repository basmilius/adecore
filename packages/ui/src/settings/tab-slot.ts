import { createContext } from 'react';

/* Where the settings dialog's header holds the tabs of the pane in front; null outside the dialog and in a split pane. */
export const SettingsTabSlotContext = createContext<HTMLElement | null>(null);
