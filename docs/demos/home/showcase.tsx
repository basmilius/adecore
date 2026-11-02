import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    ArrowDownToLine,
    BookOpen,
    ChartNoAxesColumn,
    CloudSun,
    FileCode,
    Folder,
    GitBranch,
    GitCompare,
    MessageSquare,
    Package,
    PanelLeft,
    Play,
    Plus,
    Search,
    Settings,
    Square,
    SquareTerminal
} from 'lucide-react';
import { useChatScope } from '@adecore/agents-react';
import { Composer, Timeline } from '@adecore/agents-react/chat/ui';
import { AgentIcon } from '@adecore/agents-react/providers';
import { useChatRow } from '@adecore/agents-react/state';
import { UsageDialog, UsageLimitsCard, UsagePage } from '@adecore/agents-react/usage';
import type { EditorOptions } from '@adecore/editor';
import { TerminalView, type TerminalViewHandle } from '@adecore/terminal';
import {
    Icon,
    IconButton,
    ListRow,
    SectionLabel,
    Spinner,
    SplitView,
    Workspace,
    WorkspaceRail,
    WorkspaceRailSeparator,
    WorkspaceRailSpacer,
    WorkspaceTopRow,
    createSplitLayout,
    splitPanes,
    updateSplitLayout,
    type SplitLayout
} from '@adecore/ui';
import { AgentDemo } from '../shared/agents.tsx';
import { DEMO_CHAT } from '../shared/agents-host.ts';
import { useEditor } from '../shared/editor.ts';

type ViewId = 'chat' | 'review' | 'editor' | 'terminal';

const VIEWS: Record<ViewId, { label: string; icon: typeof FileCode }> = {
    chat: { label: 'Retry for fetchJson', icon: MessageSquare },
    review: { label: 'Review the pull request', icon: MessageSquare },
    editor: { label: 'http.ts', icon: FileCode },
    terminal: { label: 'Tests', icon: SquareTerminal }
};

const OUTPUT =
    '\x1b[1mbun test src/http.test.ts\x1b[0m\r\n\r\n\x1b[32m✓\x1b[0m retries a server error\r\n\x1b[32m✓\x1b[0m throws a client error at once\r\n\x1b[32m✓\x1b[0m waits longer each attempt\r\n\x1b[32m✓\x1b[0m stops after three attempts\r\n\r\n\x1b[32m 4 pass\x1b[0m\r\n\x1b[2m 0 fail\x1b[0m\r\n';

const HTTP_SOURCE = `/** Fetches JSON, and retries a server error with a growing wait. */
export async function fetchJson<T>(url: string, attempts = 3): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        const response = await fetch(url);

        if (response.ok) {
            return (await response.json()) as T;
        }

        if (response.status < 500 || attempt === attempts) {
            throw new Error(\`\${url} answered \${response.status}\`);
        }

        await sleep(500 * 2 ** (attempt - 1));
    }
}
`;

const HTTP_OPTIONS: EditorOptions = { text: HTTP_SOURCE, language: 'typescript', path: '/station/src/http.ts', theme: 'demo' };

function initialLayout(): SplitLayout {
    const chats = createSplitLayout(['chat', 'review'], 'chats');

    const columns = updateSplitLayout(chats, {
        type: 'split',
        paneId: 'chats',
        side: 'right',
        newPane: { type: 'pane', id: 'files', views: ['editor'], active: 'editor' },
        splitId: 'columns'
    });

    const rows = updateSplitLayout(columns, {
        type: 'split',
        paneId: 'files',
        side: 'bottom',
        newPane: { type: 'pane', id: 'shell', views: ['terminal'], active: 'terminal' },
        splitId: 'rows'
    });

    return updateSplitLayout(rows, { type: 'focus', paneId: 'chats' });
}

function Chat() {
    const scope = useChatScope();
    const info = useChatRow(DEMO_CHAT, (row) => row?.info);

    useEffect(() => {
        void scope.chats.open(DEMO_CHAT, {});

        return () => void scope.chats.detach(DEMO_CHAT);
    }, [scope]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <Timeline
                chatId={DEMO_CHAT}
                composer={
                    info && (
                        <Composer
                            chatId={DEMO_CHAT}
                            info={info}
                            focused={false}
                            disabled={false}
                            providerFixed={false}
                            onSend={(text, extras) => void scope.chats.send(DEMO_CHAT, text, extras)}
                            onRetarget={(provider, selection) => scope.chats.retarget(DEMO_CHAT, provider, selection)}
                        />
                    )
                }
            />
        </div>
    );
}

function Code() {
    const { host } = useEditor(HTTP_OPTIONS);

    return (
        <div className="relative h-full">
            <div ref={host} className="absolute inset-0" />
        </div>
    );
}

function Tests() {
    const view = useRef<TerminalViewHandle>(null);

    useEffect(() => {
        view.current?.write(OUTPUT);
    }, []);

    return <TerminalView ref={view} label="Tests" className="h-full" />;
}

const ROW = 'w-full gap-2 text-left text-sm font-medium';
const ICON_SLOT = 'grid size-4 shrink-0 place-items-center';
const FOOTER_BUTTON = 'flex h-8 grow items-center gap-2 rounded-md px-2 text-sm text-text-muted hover:bg-surface-hover hover:text-text';

function ViewGlyph({ id }: { id: ViewId }) {
    if (id === 'chat' || id === 'review') {
        return <AgentIcon kind={id === 'chat' ? 'claude' : 'codex'} size={14} />;
    }

    return <Icon icon={VIEWS[id].icon} size={14} className="text-text-muted" />;
}

/* The wordmark of the docs site, standing in for the brand of the app built on the packages. */
function Wordmark() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ADE CORE" fill="none" viewBox="0 0 207 54" className="h-[18px] w-auto text-text">
            <path
                fill="currentColor"
                d="M0 45 8.5 9h9.04l8.6 36h-7.27l-1.66-8.14H8.94L7.27 45zm10.12-14.05h5.85l-1.66-8.68q-.34-1.88-.72-3.7l-.52-2.91-1.19 6.56zM30.3 45V9h11.27q3.6 0 6.27 1.43 2.7 1.43 4.19 4.04a11.7 11.7 0 0 1 1.52 6.07v12.87q0 3.45-1.52 6.07a10.4 10.4 0 0 1-4.19 4.09A13 13 0 0 1 41.57 45zm7.13-6.9h4.14q2.19 0 3.52-1.29a4.5 4.5 0 0 0 1.33-3.4V20.54q0-2.07-1.33-3.35a4.9 4.9 0 0 0-3.52-1.29h-4.14zM59.61 45V9H81v6.31H66.6v8.09h12.74v6.31H66.6v8.98H81V45zM140.23 17.68q1.65 0 2.44.83.8.82.8 2.41v11.16q0 1.55-.83 2.41-.8.83-2.41.83-1.62 0-2.45-.83a3.4 3.4 0 0 1-.8-2.41V20.92q0-1.59.8-2.41.79-.83 2.45-.83M161.81 18.04q1.8 0 2.77.94 1.01.93 1.01 2.62a3.2 3.2 0 0 1-1 2.52q-.98.9-2.78.9h-3.1v-6.98z"
            />
            <path
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
                d="M198 0a9 9 0 0 1 9 9v36a9 9 0 0 1-9 9h-93a9 9 0 0 1-9-9V9a9 9 0 0 1 9-9zm-79.22 13q-2.62 0-4.6 1a7.5 7.5 0 0 0-3.1 2.74 8 8 0 0 0-1.08 4.18v11.16q0 2.38 1.08 4.18a7.7 7.7 0 0 0 3.1 2.77q1.98.97 4.6.97 2.67 0 4.61-.97a7.5 7.5 0 0 0 4.18-6.95h-5.4q0 1.55-.9 2.41-.86.83-2.49.83a3.6 3.6 0 0 1-2.52-.83 3.3 3.3 0 0 1-.86-2.41V20.92q0-1.59.86-2.41.9-.83 2.52-.83t2.49.83q.9.82.9 2.41h5.4q0-2.4-1.12-4.18a7.2 7.2 0 0 0-3.06-2.73q-1.95-1-4.6-1.01m21.45 0a10 10 0 0 0-4.58 1 7 7 0 0 0-3.02 2.78 8 8 0 0 0-1.04 4.14v11.16q0 2.38 1.04 4.18a7.5 7.5 0 0 0 3.02 2.77q1.94.97 4.58.97 2.66 0 4.57-.97 1.94-1.01 2.99-2.77a8 8 0 0 0 1.08-4.18V20.92q0-2.37-1.08-4.14a7 7 0 0 0-3-2.77q-1.9-1-4.56-1.01m13.12.36v26.28h5.37V29.7h2.52l4.24 9.94h5.87l-4.97-10.8a7 7 0 0 0 3.35-2.92 8.5 8.5 0 0 0 1.26-4.57q0-2.45-1.15-4.25a7.3 7.3 0 0 0-3.17-2.77 11 11 0 0 0-4.86-.97zm22.13 0v26.28h16.2v-4.6h-10.91v-6.56h9.65v-4.6h-9.65v-5.91h10.9v-4.61z"
            />
        </svg>
    );
}

function NeedsYouDot() {
    return <span className="size-1.5 shrink-0 rounded-full bg-status-needs-you" />;
}

function ViewRow({ id, active, onOpen, children }: { id: ViewId; active: boolean; onOpen(id: ViewId): void; children?: ReactNode }) {
    return (
        <ListRow
            variant="inset"
            render={<button type="button" />}
            aria-current={active ? 'true' : undefined}
            onClick={() => onOpen(id)}
            className={`${ROW} ${active ? 'bg-surface-active text-text' : 'text-text-muted hover:bg-surface-hover hover:text-text'}`}
        >
            <span className={ICON_SLOT}>
                <ViewGlyph id={id} />
            </span>
            <span className="min-w-0 truncate">{VIEWS[id].label}</span>
            <span className="grow" />
            {children}
        </ListRow>
    );
}

function ProjectHeading({ name, icon, count }: { name: string; icon: typeof FileCode; count?: number }) {
    return (
        <ListRow variant="inset" render={<button type="button" />} className={`${ROW} text-text hover:bg-surface-hover`}>
            <span className={ICON_SLOT}>
                <Icon icon={icon} size={14} />
            </span>
            <span className="min-w-0 grow truncate">{name}</span>
            {count !== undefined && <span className="text-xs text-status-needs-you tabular-nums">{count}</span>}
        </ListRow>
    );
}

function Sidebar({ active, onOpen, onHide }: { active: ViewId; onOpen(id: ViewId): void; onHide(): void }) {
    return (
        <aside className="flex h-full w-[248px] flex-col border-r border-border bg-surface">
            <div className="flex h-12 shrink-0 items-center justify-between pr-2 pl-4">
                <Wordmark />
                <IconButton icon={PanelLeft} label="Hide sidebar" onClick={onHide} />
            </div>
            <nav className="mt-2 min-h-0 grow overflow-auto px-2">
                <div className="-mx-2 mb-3 flex flex-col gap-px border-y border-border bg-surface-raised px-2 py-1">
                    <SectionLabel render={<div />} className="flex items-center gap-1.5 px-2 py-1">
                        <NeedsYouDot />
                        Needs you
                        <span className="ml-auto tabular-nums">1</span>
                    </SectionLabel>
                    <ViewRow id="review" active={active === 'review'} onOpen={onOpen}>
                        <span className="text-xs text-text-faint">Approve</span>
                        <NeedsYouDot />
                    </ViewRow>
                </div>
                <div className="mb-px flex flex-col gap-px">
                    <ProjectHeading name="Weather station" icon={CloudSun} count={1} />
                    <ViewRow id="chat" active={active === 'chat'} onOpen={onOpen}>
                        <Spinner size={12} className="text-text-faint" />
                    </ViewRow>
                    <ViewRow id="review" active={active === 'review'} onOpen={onOpen}>
                        <NeedsYouDot />
                    </ViewRow>
                    <ViewRow id="editor" active={active === 'editor'} onOpen={onOpen}>
                        <span className="size-1.5 shrink-0 rounded-full bg-text-muted" />
                    </ViewRow>
                    <ViewRow id="terminal" active={active === 'terminal'} onOpen={onOpen} />
                </div>
                <div role="separator" className="my-1 h-px shrink-0 bg-border-soft" />
                <ProjectHeading name="Docs site" icon={BookOpen} />
                <ProjectHeading name="Release tooling" icon={Package} />
            </nav>
            <div className="flex shrink-0 items-center gap-1 border-t border-border px-2 py-1.5">
                <button type="button" className={FOOTER_BUTTON}>
                    <Icon icon={Plus} size={14} /> New view
                </button>
            </div>
        </aside>
    );
}

type PanelId = 'files' | 'changes';

const PANELS: Record<PanelId, { label: string; icon: typeof FileCode }> = {
    files: { label: 'Files', icon: Folder },
    changes: { label: 'Changes', icon: GitCompare }
};

const FILES = ['src/http.ts', 'src/http.test.ts', 'src/station.ts', 'src/sensors.ts', 'package.json', 'README.md'];

const CHANGES = [
    { path: 'src/http.ts', added: 14, removed: 3 },
    { path: 'src/http.test.ts', added: 41, removed: 0 }
];

function SidePanel({ panel }: { panel: PanelId }) {
    return (
        <section className="flex h-full flex-col bg-surface">
            <header className="flex h-10 shrink-0 items-center border-b border-border px-3 text-sm font-medium text-text">{PANELS[panel].label}</header>
            <div className="min-h-0 grow overflow-auto py-1">
                {panel === 'files'
                    ? FILES.map((path) => (
                          <ListRow key={path} variant="flat" className="gap-2 px-3 text-sm text-text-muted">
                              <Icon icon={FileCode} size={14} className="text-text-faint" />
                              <span className="truncate">{path}</span>
                          </ListRow>
                      ))
                    : CHANGES.map((change) => (
                          <ListRow key={change.path} variant="flat" className="gap-2 px-3 text-sm text-text-muted">
                              <span className="min-w-0 grow truncate">{change.path}</span>
                              <span className="text-xs text-positive tabular-nums">+{change.added}</span>
                              <span className="text-xs text-status-error tabular-nums">-{change.removed}</span>
                          </ListRow>
                      ))}
            </div>
        </section>
    );
}

function Review() {
    return <div className="flex h-full items-center justify-center text-sm text-text-muted">The agent waits for the pull request to build.</div>;
}

/* A workspace of views as an app built on the packages lays it out: agent chats beside the file they change and the tests they run. */
export default function ShowcaseDemo() {
    const [layout, setLayout] = useState(initialLayout);
    const [sidebar, setSidebar] = useState(true);
    const [panel, setPanel] = useState<PanelId | null>(null);
    const [running, setRunning] = useState(false);
    const [usage, setUsage] = useState(false);

    const panes = splitPanes(layout.root);
    const active = (panes.find((pane) => pane.id === layout.focused)?.active ?? 'chat') as ViewId;

    const open = (id: ViewId): void => {
        const pane = panes.find((candidate) => candidate.views.includes(id));

        if (pane === undefined) {
            return;
        }

        setLayout((current) =>
            updateSplitLayout(updateSplitLayout(current, { type: 'activate', paneId: pane.id, viewId: id }), { type: 'focus', paneId: pane.id })
        );
    };

    return (
        <AgentDemo>
            <div className="h-[600px] w-full overflow-hidden rounded-xl border border-border text-left">
                <Workspace
                    layout="standard"
                    sidebarWidth="auto"
                    sidebar={sidebar && <Sidebar active={active} onOpen={open} onHide={() => setSidebar(false)} />}
                    toolbar={
                        <WorkspaceTopRow leading={!sidebar && <IconButton icon={PanelLeft} label="Show sidebar" onClick={() => setSidebar(true)} />}>
                            <span className="flex min-w-0 items-center gap-1.5 text-sm text-text-muted">
                                <Icon icon={GitBranch} size={14} />
                                <span className="truncate">fetch-retry</span>
                            </span>
                        </WorkspaceTopRow>
                    }
                    sidePanelWidth={260}
                    sidePanelOpen={panel !== null}
                    sidePanel={panel !== null && <SidePanel panel={panel} />}
                    rail={
                        <WorkspaceRail>
                            <IconButton icon={Search} label="Search" tooltipSide="left" />
                            <WorkspaceRailSeparator />
                            <IconButton
                                icon={running ? Square : Play}
                                label={running ? 'Stop the dev server' : 'Start the dev server'}
                                tooltipSide="left"
                                active={running}
                                className={running ? 'text-status-running hover:text-status-running' : undefined}
                                onClick={() => setRunning(!running)}
                            />
                            <WorkspaceRailSeparator />
                            {(Object.keys(PANELS) as PanelId[]).map((id) => (
                                <IconButton
                                    key={id}
                                    icon={PANELS[id].icon}
                                    label={PANELS[id].label}
                                    tooltipSide="left"
                                    active={panel === id}
                                    onClick={() => setPanel(panel === id ? null : id)}
                                />
                            ))}
                            <WorkspaceRailSpacer />
                            <IconButton icon={ArrowDownToLine} label="Update ready" tooltipSide="left" className="text-positive hover:text-positive" />
                            <WorkspaceRailSeparator />
                            <UsageLimitsCard side="left">
                                <IconButton icon={ChartNoAxesColumn} label="Usage" tooltip={false} onClick={() => setUsage(true)} />
                            </UsageLimitsCard>
                            <IconButton icon={Settings} label="Settings" tooltipSide="left" />
                        </WorkspaceRail>
                    }
                >
                    <SplitView
                        value={layout}
                        onValueChange={setLayout}
                        getTab={(id) => ({ label: VIEWS[id as ViewId].label, icon: <Icon icon={VIEWS[id as ViewId].icon} size={14} /> })}
                        renderView={(id) => {
                            if (id === 'chat') {
                                return <Chat />;
                            }

                            if (id === 'editor') {
                                return <Code />;
                            }

                            if (id === 'terminal') {
                                return <Tests />;
                            }

                            return <Review />;
                        }}
                    />
                </Workspace>
            </div>
            <UsageDialog open={usage} onOpenChange={setUsage}>
                <UsagePage />
            </UsageDialog>
        </AgentDemo>
    );
}
