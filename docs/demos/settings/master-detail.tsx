import { useState } from 'react';
import { Laptop, Smartphone, Trash } from 'lucide-react';
import { Button, Icon } from '@adecore/ui';
import { DetailHeader, MasterDetail, MasterItem, SettingsRow, SettingsSection } from '@adecore/ui/settings';

const DEVICES = [
    { id: 'laptop', name: 'Work laptop', kind: 'macOS', icon: Laptop },
    { id: 'phone', name: 'Phone', kind: 'iOS', icon: Smartphone }
];

export default function MasterDetailDemo() {
    const [picked, setPicked] = useState('laptop');
    const device = DEVICES.find((entry) => entry.id === picked)!;

    return (
        <div className="flex h-80 w-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
            <MasterDetail
                listWidth={280}
                listLabel="Devices"
                list={DEVICES.map((entry) => (
                    <MasterItem key={entry.id} selected={picked === entry.id} onSelect={() => setPicked(entry.id)}>
                        <Icon icon={entry.icon} className="text-text-muted" />
                        {entry.name}
                    </MasterItem>
                ))}
                detail={
                    <>
                        <DetailHeader
                            mark={
                                <span className="grid size-10 place-items-center rounded-lg bg-surface-sunken text-text-muted">
                                    <Icon icon={device.icon} size={20} />
                                </span>
                            }
                            title={device.name}
                            subtitle={<>{device.kind}, signed in</>}
                            actions={
                                <Button size="sm" variant="danger-outline">
                                    <Icon icon={Trash} size={14} />
                                    Remove
                                </Button>
                            }
                        />
                        <SettingsSection>
                            <SettingsRow label="Last seen" control={<span className="text-xs text-text-muted">Today</span>} />
                        </SettingsSection>
                    </>
                }
            />
        </div>
    );
}
