import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { TabsList, TabsRoot, TabsTab } from '../tabs/parts.tsx';
import { SettingsTabSlotContext } from './tab-slot.ts';

export interface SettingsTabsProps<Id extends string> {
    value: Id;
    tabs: readonly { id: NoInfer<Id>; label: string }[];
    label: string;
    onValueChange(next: NoInfer<Id>): void;
}

/*
 * Tabs over a pane, which draws the picked tab under them itself. In a pane of the settings dialog they stand in its
 * header under the title, so they stay while the pane scrolls under its fade. Anywhere else, such as in the detail of a
 * `MasterDetail`, they stand where they are drawn.
 */
export function SettingsTabs<Id extends string>({ value, tabs, label, onValueChange }: SettingsTabsProps<Id>) {
    const slot = useContext(SettingsTabSlotContext);
    const strip = (
        <TabsRoot value={value} onValueChange={(next) => onValueChange(next as Id)} className="shrink-0">
            <TabsList aria-label={label}>
                {tabs.map((tab) => (
                    <TabsTab key={tab.id} value={tab.id}>
                        {tab.label}
                    </TabsTab>
                ))}
            </TabsList>
        </TabsRoot>
    );

    return slot === null ? strip : createPortal(strip, slot);
}
