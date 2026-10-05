import { useSyncExternalStore } from 'react';
import { Select } from '@adecore/ui';
import { FORMAT_LANGUAGE, FORMAT_REGION_CHOICES, FORMAT_SYSTEM, regionName } from '@adecore/ui/format';
import { preferences } from './preferences.ts';

const LANGUAGES = [
    { value: 'en', label: 'English' },
    { value: 'nl', label: 'Nederlands' }
];

const regionLabel = (region: string, language: string): string => {
    if (region === FORMAT_LANGUAGE) {
        return 'Follow the language';
    }
    return region === FORMAT_SYSTEM ? 'Follow the system' : regionName(region, language);
};

/* The two settings the formatters read, as an app's settings would offer them. */
export function PreferencesBar() {
    const { language, region } = useSyncExternalStore(preferences.subscribe, preferences.get, preferences.get);

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Select label="Language" size="sm" value={language} onValueChange={(next) => preferences.set({ language: next })} items={LANGUAGES} />
            <Select
                label="Region"
                size="sm"
                value={region}
                onValueChange={(next) => preferences.set({ region: next })}
                items={FORMAT_REGION_CHOICES.map((choice) => ({ value: choice, label: regionLabel(choice, language) }))}
            />
        </div>
    );
}
