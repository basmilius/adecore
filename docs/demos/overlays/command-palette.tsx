import { Button, CommandPalette, Icon, Kbd, KEY_SHORTCUTS, matchScore, shortcut, type Shortcut } from '@adecore/ui';
import { Bug, FolderGit2, GitBranch, LayoutDashboard, LogOut, Moon, Search, Settings } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

interface Command {
    id: string;
    label: string;
    icon: ReactNode;
    hint?: string;
    shortcut?: Shortcut;
}

interface Group {
    value: string;
    items: Command[];
}

const icon = (glyph: typeof Bug): ReactNode => <Icon icon={glyph} size={14} />;

const GROUPS: Group[] = [
    {
        value: 'Go to',
        items: [
            { id: 'overview', label: 'Overview', icon: icon(LayoutDashboard), shortcut: shortcut('Mod+1') },
            { id: 'branches', label: 'Branches', icon: icon(GitBranch), shortcut: shortcut('Mod+2') },
            { id: 'settings', label: 'Settings', icon: icon(Settings), shortcut: shortcut('Mod+,') }
        ]
    },
    {
        value: 'Projects',
        items: [
            { id: 'docs', label: 'Documentation site', icon: icon(FolderGit2), hint: '~/Projects/docs' },
            { id: 'desktop', label: 'Desktop app', icon: icon(FolderGit2), hint: '~/Projects/desktop' }
        ]
    },
    {
        value: 'Actions',
        items: [
            { id: 'theme', label: 'Switch to the dark theme', icon: icon(Moon) },
            { id: 'sign-out', label: 'Sign out', icon: icon(LogOut) }
        ]
    }
];

const ISSUES: Command[] = [
    { id: 'issue-1', label: 'Sidebar loses its width after a restart', icon: icon(Bug), hint: 'DESK-118' },
    { id: 'issue-2', label: 'Settings dialog opens behind the window', icon: icon(Bug), hint: 'DESK-131' }
];

/* The rows of each group that match, best first; a group with none drops out. */
const rank = (groups: Group[], query: string): Group[] =>
    groups
        .map((group) => ({
            ...group,
            items: group.items
                .map((item) => ({ item, score: matchScore(`${item.label} ${item.hint ?? ''}`, query) }))
                .filter((entry): entry is { item: Command; score: number } => entry.score !== null)
                .sort((first, second) => second.score - first.score)
                .map((entry) => entry.item)
        }))
        .filter((group) => group.items.length > 0);

/* Issues come from a request, a moment after the last key; the last answer stays until the next one lands. */
function useIssues(query: string): Command[] {
    const [found, setFound] = useState<Command[]>([]);

    useEffect(() => {
        if (query.trim() === '') {
            return;
        }

        const timer = window.setTimeout(() => setFound(ISSUES.filter((issue) => matchScore(`${issue.label} ${issue.hint}`, query) !== null)), 200);

        return () => window.clearTimeout(timer);
    }, [query]);

    return query.trim() === '' ? [] : found;
}

export default function CommandPaletteDemo() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [ran, setRan] = useState<string | null>(null);
    const issues = useIssues(query);
    const groups = [...(issues.length > 0 ? [{ value: 'Issues', items: issues }] : []), ...rank(GROUPS, query)];

    const run = (command: Command): void => {
        setOpen(false);
        setRan(command.label);
    };

    return (
        <div className="flex items-center gap-3">
            <Button onClick={() => setOpen(true)}>
                <Icon icon={Search} size={14} />
                Jump to
            </Button>
            {ran !== null && <span className="text-xs text-text-muted">Ran “{ran}”</span>}
            <CommandPalette.Root
                open={open}
                onOpenChange={setOpen}
                onOpenChangeComplete={(isOpen) => !isOpen && setQuery('')}
                items={groups}
                filter={null}
                value={query}
                onValueChange={setQuery}
                itemToStringValue={(command: Command) => command.label}
            >
                <CommandPalette.Popup>
                    <CommandPalette.Input aria-label="Jump to" placeholder="Jump to a screen, a project or an action" />
                    <CommandPalette.Empty>Nothing matches</CommandPalette.Empty>
                    <CommandPalette.List>
                        {(group: Group) => (
                            <CommandPalette.Group key={group.value} items={group.items}>
                                <CommandPalette.GroupLabel>{group.value}</CommandPalette.GroupLabel>
                                <CommandPalette.Collection>
                                    {(command: Command) => (
                                        <CommandPalette.Item
                                            key={command.id}
                                            value={command}
                                            icon={command.icon}
                                            hint={command.hint}
                                            shortcut={command.shortcut}
                                            onClick={() => run(command)}
                                        >
                                            {command.label}
                                        </CommandPalette.Item>
                                    )}
                                </CommandPalette.Collection>
                            </CommandPalette.Group>
                        )}
                    </CommandPalette.List>
                    <CommandPalette.Footer>
                        <span className="flex items-center gap-1.5">
                            <Kbd variant="inline">↑</Kbd>
                            <Kbd variant="inline">↓</Kbd> Move
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Kbd shortcut={KEY_SHORTCUTS.enter} variant="inline" /> Run
                        </span>
                    </CommandPalette.Footer>
                </CommandPalette.Popup>
            </CommandPalette.Root>
        </div>
    );
}
