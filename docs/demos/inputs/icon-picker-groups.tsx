import { useState } from 'react';
import {
    Bot,
    Brain,
    Braces,
    Bug,
    Cloud,
    Code,
    Container,
    Cpu,
    Database,
    GitBranch,
    GitMerge,
    Globe,
    HardDrive,
    Laptop,
    Monitor,
    Network,
    Server,
    Smartphone,
    Sparkles,
    Terminal,
    Wand
} from 'lucide-react';
import { IconPicker, type IconPickerGroup } from '@basmilius/desktop-ui';

const GROUPS: IconPickerGroup[] = [
    { id: 'code', label: 'Code', icons: { code: Code, braces: Braces, terminal: Terminal, bug: Bug, 'git-branch': GitBranch, 'git-merge': GitMerge } },
    { id: 'ai', label: 'AI', icons: { bot: Bot, brain: Brain, sparkles: Sparkles, wand: Wand } },
    { id: 'infra', label: 'Infrastructure', icons: { server: Server, cloud: Cloud, database: Database, container: Container, network: Network, globe: Globe } },
    { id: 'hardware', label: 'Hardware', icons: { cpu: Cpu, 'hard-drive': HardDrive, laptop: Laptop, monitor: Monitor, smartphone: Smartphone } }
];

const KEYWORDS = { container: ['docker'], bot: ['agent'], database: ['sql'] };

export default function IconPickerGroupsDemo() {
    const [icon, setIcon] = useState<string | null>('database');

    return <IconPicker className="w-72" icons={GROUPS} keywords={KEYWORDS} rows={4} value={icon} onValueChange={setIcon} />;
}
