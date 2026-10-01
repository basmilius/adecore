import { useState } from 'react';
import { Bell, Info, Keyboard, Palette, Settings, Sparkles } from 'lucide-react';
import { Button, Icon, Select, Switch } from '@basmilius/desktop-ui';
import { MasterDetail, MasterItem, SettingsDialog, SettingsRow, SettingsSection, type SettingsSearchResult } from '@basmilius/desktop-ui/settings';

function AppearancePane() {
    const [theme, setTheme] = useState('system');
    const [compact, setCompact] = useState(false);

    return (
        <SettingsSection title="Window" description="How the app looks on this computer.">
            <SettingsRow
                label="Theme"
                searchId="theme"
                control={
                    <Select
                        label="Theme"
                        value={theme}
                        onValueChange={setTheme}
                        items={[
                            { value: 'system', label: 'Match the system' },
                            { value: 'light', label: 'Light' },
                            { value: 'dark', label: 'Dark' }
                        ]}
                    />
                }
            />
            <SettingsRow
                label="Compact rows"
                description="Fits more on a small screen."
                searchId="compact"
                control={<Switch label="Compact rows" checked={compact} onCheckedChange={setCompact} />}
            />
        </SettingsSection>
    );
}

function NotificationsPane() {
    const [sounds, setSounds] = useState(true);

    return (
        <SettingsSection title="Alerts">
            <SettingsRow label="Play a sound" searchId="sound" control={<Switch label="Play a sound" checked={sounds} onCheckedChange={setSounds} />} />
        </SettingsSection>
    );
}

const SHORTCUT_GROUPS = ['General', 'Editing', 'Navigation'];

function ShortcutsPane() {
    const [picked, setPicked] = useState('General');

    return (
        <MasterDetail
            listWidth={280}
            listLabel="Shortcut groups"
            list={SHORTCUT_GROUPS.map((group) => (
                <MasterItem key={group} selected={picked === group} onSelect={() => setPicked(group)}>
                    {group}
                </MasterItem>
            ))}
            detail={<p className="text-sm text-text-muted">The shortcuts of {picked.toLowerCase()} go here.</p>}
        />
    );
}

function AboutHero() {
    return (
        <div className="flex flex-col items-center gap-1.5 bg-surface-sunken px-8 pt-28 pb-12 text-center">
            <Icon icon={Sparkles} size={20} className="mb-2 text-accent" />
            <h3 className="text-lg font-semibold text-text">Example</h3>
            <p className="text-xs text-text-muted">Version 1.0.0</p>
        </div>
    );
}

const DETAILS = [
    { label: 'Electron', value: '38.2.0' },
    { label: 'Chromium', value: '140.0.7339' },
    { label: 'Node', value: '22.19.0' },
    { label: 'Platform', value: 'macOS' }
];

const LINKS = ['Website', 'Source code', 'Report a problem'];

function AboutPane() {
    const [automatic, setAutomatic] = useState(true);

    return (
        <>
            <SettingsSection title="Updates">
                <SettingsRow
                    label="Download updates by themselves"
                    control={<Switch label="Download updates by themselves" checked={automatic} onCheckedChange={setAutomatic} />}
                />
            </SettingsSection>
            <SettingsSection title="Details">
                {DETAILS.map((row) => (
                    <SettingsRow key={row.label} label={row.label} control={<span className="text-xs text-text-muted">{row.value}</span>} />
                ))}
            </SettingsSection>
            <SettingsSection title="Links">
                {LINKS.map((link) => (
                    <SettingsRow
                        key={link}
                        label={link}
                        control={
                            <Button variant="secondary" size="sm">
                                Open
                            </Button>
                        }
                    />
                ))}
            </SettingsSection>
        </>
    );
}

const GROUPS = [
    {
        label: null,
        sections: [
            { id: 'appearance', icon: Palette, label: 'Appearance', description: 'Theme and density.', pane: AppearancePane },
            { id: 'notifications', icon: Bell, label: 'Notifications', description: 'What asks for your attention.', pane: NotificationsPane }
        ]
    },
    {
        label: 'Advanced',
        sections: [{ id: 'shortcuts', icon: Keyboard, label: 'Shortcuts', description: 'Every key the app knows.', pane: ShortcutsPane, split: true }]
    }
];

const FOOTER = [{ id: 'about', icon: Info, label: 'About', description: 'The version you run.', pane: AboutPane, hero: AboutHero }];

const SEARCHABLE: SettingsSearchResult[] = [
    { section: 'appearance', id: null, label: 'Appearance' },
    { section: 'appearance', id: 'theme', label: 'Theme' },
    { section: 'appearance', id: 'compact', label: 'Compact rows' },
    { section: 'notifications', id: 'sound', label: 'Play a sound' },
    { section: 'shortcuts', id: null, label: 'Shortcuts' }
];

const search = {
    find: (query: string) => SEARCHABLE.filter((result) => result.label.toLowerCase().includes(query.trim().toLowerCase())),
    hint: '⌘F'
};

export default function SettingsDialogDemo() {
    const [open, setOpen] = useState(false);
    const [section, setSection] = useState('appearance');
    const [target, setTarget] = useState<string | null>(null);

    return (
        <>
            <Button variant="secondary" onClick={() => setOpen(true)}>
                <Icon icon={Settings} size={14} />
                Open settings
            </Button>
            <SettingsDialog
                open={open}
                onOpenChange={setOpen}
                section={section}
                onNavigate={(next) => {
                    setSection(next.section);
                    setTarget(next.target ?? null);
                }}
                groups={GROUPS}
                footer={FOOTER}
                search={search}
                target={target}
                onTargetShown={() => setTarget(null)}
            />
        </>
    );
}
