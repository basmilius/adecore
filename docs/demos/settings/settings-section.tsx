import { useState } from 'react';
import { Globe, Monitor } from 'lucide-react';
import { Button, Pill, Select, Switch } from '@basmilius/desktop-ui';
import { SettingsRow, SettingsSection, TopIcon } from '@basmilius/desktop-ui/settings';

export default function SettingsSectionDemo() {
    const [updates, setUpdates] = useState(true);
    const [beta, setBeta] = useState(false);
    const [channel, setChannel] = useState('stable');

    return (
        <SettingsSection
            className="w-full max-w-xl"
            title="Updates"
            icon={Globe}
            description="How this app stays current."
            tag={<Pill shape="tag">This computer</Pill>}
            action={
                <Button size="sm" variant="secondary">
                    Check now
                </Button>
            }
            footer="The last check was a minute ago."
        >
            <SettingsRow
                label="Install updates automatically"
                description="Downloads in the background and installs when you quit."
                control={<Switch label="Install updates automatically" checked={updates} onCheckedChange={setUpdates} />}
            />
            <SettingsRow indent label="Include betas" control={<Switch label="Include betas" checked={beta} onCheckedChange={setBeta} />} />
            <SettingsRow
                label="Channel"
                leading={<TopIcon icon={Monitor} className="text-text-faint" />}
                control={
                    <Select
                        label="Channel"
                        value={channel}
                        onValueChange={setChannel}
                        items={[
                            { value: 'stable', label: 'Stable' },
                            { value: 'nightly', label: 'Nightly' }
                        ]}
                    />
                }
            />
            <SettingsRow muted label="Version 1.0.0" />
        </SettingsSection>
    );
}
