import { useSyncExternalStore } from 'react';
import { FORMAT_REGIONS, formatRegionFrom, localTimeZone, regionName, systemLocale, useFormatLocale } from '@adecore/ui/format';
import { PreferencesBar } from '../shared/preferences-bar.tsx';
import { preferences } from '../shared/preferences.ts';
import { Values } from '../shared/values.tsx';

export default function RegionsDemo() {
    useFormatLocale();
    const { language } = useSyncExternalStore(preferences.subscribe, preferences.get, preferences.get);

    return (
        <div className="flex w-full max-w-lg flex-col gap-4">
            <PreferencesBar />
            <Values
                rows={[
                    ...FORMAT_REGIONS.map((region): [string, string] => [`regionName('${region}', '${language}')`, regionName(region, language)]),
                    ["formatRegionFrom('xx-XX')", formatRegionFrom('xx-XX')],
                    ['systemLocale()', systemLocale()],
                    ['localTimeZone()', localTimeZone() ?? 'null']
                ]}
            />
        </div>
    );
}
