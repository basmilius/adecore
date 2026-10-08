import { useState } from 'react';
import { FileText, Moon, PanelLeft, PanelRight, Sun } from 'lucide-react';
import { Button, Icon, IconButton, SplitView, Workspace, createSplitLayout, updateSplitLayout, type SplitLayout, type WorkspaceLayout } from '@adecore/ui';

function initialLayout(): SplitLayout {
    const first = createSplitLayout(['Brief', 'Notes'], 'documents');
    const second = updateSplitLayout(first, {
        type: 'split',
        paneId: 'documents',
        side: 'right',
        newPane: { type: 'pane', id: 'preview', views: ['Preview'], active: 'Preview' },
        splitId: 'columns'
    });
    return updateSplitLayout(second, {
        type: 'split',
        paneId: 'preview',
        side: 'bottom',
        newPane: { type: 'pane', id: 'output', views: ['Output'], active: 'Output' },
        splitId: 'rows'
    });
}

function Document({ name }: { name: string }) {
    const [text, setText] = useState(`Working notes for ${name}.\n\nEdit this text, then move its tab into another panel. The text stays with the view.`);
    return (
        <textarea
            aria-label={`${name} contents`}
            className="h-full w-full resize-none bg-surface p-4 text-sm text-text outline-none"
            value={text}
            onChange={(event) => setText(event.target.value)}
        />
    );
}

export default function WorkspaceDemo() {
    const [value, setValue] = useState(initialLayout);
    const [layout, setLayout] = useState<WorkspaceLayout>('roomy');
    const [appearance, setAppearance] = useState<'light' | 'dark'>('dark');
    const [sidebar, setSidebar] = useState(true);
    const [panel, setPanel] = useState(false);
    const [serial, setSerial] = useState(1);
    const split = (side: 'right' | 'bottom'): void => {
        const name = `Draft ${serial}`;
        setValue((current) =>
            updateSplitLayout(current, {
                type: 'split',
                paneId: current.focused,
                side,
                newPane: { type: 'pane', id: `draft-${serial}`, views: [name], active: name },
                splitId: `split-${serial}`
            })
        );
        setSerial(serial + 1);
    };
    return (
        <div data-theme={appearance} className="flex w-full flex-col gap-3 bg-bg p-4 text-text">
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => setAppearance(appearance === 'dark' ? 'light' : 'dark')}>
                    <Icon icon={appearance === 'dark' ? Sun : Moon} size={14} />
                    {appearance === 'dark' ? 'Light appearance' : 'Dark appearance'}
                </Button>
                <Button variant="secondary" aria-pressed={layout === 'roomy'} onClick={() => setLayout(layout === 'roomy' ? 'standard' : 'roomy')}>
                    {layout === 'roomy' ? 'Roomy layout' : 'Standard layout'}
                </Button>
                <Button variant="secondary" onClick={() => split('right')}>
                    Split right
                </Button>
                <Button variant="secondary" onClick={() => split('bottom')}>
                    Split below
                </Button>
                <Button
                    onClick={() => {
                        setValue(initialLayout());
                        setSerial(1);
                    }}
                >
                    Reset layout
                </Button>
            </div>
            <div className="w-full overflow-x-auto rounded-lg border border-border">
                <div className="h-[480px] min-w-[640px]">
                    <Workspace
                        layout={layout}
                        sidebarWidth={120}
                        sidePanelWidth={140}
                        sidebar={
                            sidebar && (
                                <div className="p-3 text-xs text-text-muted">
                                    Project files
                                    <br />
                                    <br />
                                    Brief
                                    <br />
                                    Notes
                                    <br />
                                    Preview
                                </div>
                            )
                        }
                        sidePanel={panel && <div className="p-3 text-xs text-text-muted">Details</div>}
                        toolbar={
                            <div className="flex h-12 items-center gap-2 px-2">
                                <IconButton icon={PanelLeft} label="Toggle sidebar" active={sidebar} onClick={() => setSidebar(!sidebar)} />
                                <span className="min-w-0 grow truncate text-sm">Project workspace</span>
                                <IconButton icon={PanelRight} label="Toggle details" active={panel} onClick={() => setPanel(!panel)} />
                            </div>
                        }
                    >
                        <SplitView
                            value={value}
                            onValueChange={setValue}
                            getTab={(id) => ({ label: id, icon: <Icon icon={FileText} size={14} />, pinned: id === 'Brief' })}
                            renderView={(id) => <Document name={id} />}
                        />
                    </Workspace>
                </div>
            </div>
            <p className="text-xs text-text-muted">
                Drag a tab or the panel grip. Drop near an edge to split, on the tab strip to group tabs, or in the middle to swap. Drag dividers, double-click
                to balance, or use their arrow keys. Dividers snap near the middle. Alt mirrors a resize; Alt + double-click evenly distributes the chosen
                direction across the entire layout.
            </p>
        </div>
    );
}
