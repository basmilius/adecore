import type { DefaultTheme } from 'vitepress';

const group = (text: string, items: [string, string][]): DefaultTheme.SidebarItem => ({
    text,
    collapsed: false,
    items: items.map(([label, link]) => ({ text: label, link }))
});

const guide: DefaultTheme.SidebarItem[] = [group('Guide', [['Introduction', '/guide/']])];

const desktopUi: DefaultTheme.SidebarItem[] = [
    group('UI', [
        ['Overview', '/ui/'],
        ['Getting started', '/ui/guide/getting-started'],
        ['Principles', '/ui/guide/principles'],
        ['Theme', '/ui/guide/theme']
    ]),
    group('Actions', [
        ['Button', '/ui/actions/button'],
        ['IconButton', '/ui/actions/icon-button'],
        ['ButtonGroup', '/ui/actions/button-group'],
        ['CloseButton', '/ui/actions/close-button'],
        ['Pill', '/ui/actions/pill'],
        ['Tile', '/ui/actions/tile']
    ]),
    group('Inputs', [
        ['Field', '/ui/inputs/field'],
        ['Input and TextArea', '/ui/inputs/input'],
        ['Select', '/ui/inputs/select'],
        ['Switch', '/ui/inputs/switch'],
        ['Checkbox', '/ui/inputs/checkbox'],
        ['Segmented', '/ui/inputs/segmented'],
        ['Stepper', '/ui/inputs/stepper'],
        ['ChoiceCards', '/ui/inputs/choice-cards'],
        ['IconPicker', '/ui/inputs/icon-picker'],
        ['ColorSwatch', '/ui/inputs/color-swatch'],
        ['AccentSwatches', '/ui/inputs/accent-swatches']
    ]),
    group('Overlays', [
        ['Menu', '/ui/overlays/menu'],
        ['ProjectSwitcher', '/ui/overlays/project-switcher'],
        ['ContextMenu', '/ui/overlays/context-menu'],
        ['Dialog', '/ui/overlays/dialog'],
        ['PromptDialog', '/ui/overlays/prompt-dialog'],
        ['Popover', '/ui/overlays/popover'],
        ['PreviewCard', '/ui/overlays/preview-card'],
        ['Tooltip', '/ui/overlays/tooltip'],
        ['DisabledReason', '/ui/overlays/disabled-reason'],
        ['TextMenu', '/ui/overlays/text-menu'],
        ['Toasts', '/ui/overlays/toasts']
    ]),
    group('Display', [
        ['Kbd, KeyCap and Keys', '/ui/display/kbd'],
        ['ShortcutHints', '/ui/display/shortcut-hints'],
        ['Icon', '/ui/display/icon'],
        ['FileIcon', '/ui/display/file-icon'],
        ['SectionLabel', '/ui/display/section-label'],
        ['Surface', '/ui/display/surface'],
        ['ListRow', '/ui/display/list-row'],
        ['KeyValueList', '/ui/display/key-value-list'],
        ['PanelHeader', '/ui/display/panel-header'],
        ['Separator', '/ui/display/separator'],
        ['Skeleton', '/ui/display/skeleton'],
        ['Spinner', '/ui/display/spinner'],
        ['SegmentBar', '/ui/display/segment-bar'],
        ['Meter', '/ui/display/meter'],
        ['Waveform', '/ui/display/waveform'],
        ['EmptyState', '/ui/display/empty-state'],
        ['PanelEmpty', '/ui/display/panel-empty'],
        ['Banner', '/ui/display/banner'],
        ['ErrorBoundary', '/ui/display/error-boundary']
    ]),
    group('Layout', [
        ['Tabs', '/ui/layout/tabs'],
        ['SlidingColumn', '/ui/layout/sliding-column'],
        ['ColumnResizeHandle', '/ui/layout/column-resize-handle'],
        ['DockShell', '/ui/layout/dock-shell'],
        ['ZoomControls', '/ui/layout/zoom-controls'],
        ['Wipe', '/ui/layout/wipe']
    ]),
    group('Settings', [
        ['SettingsDialog', '/ui/settings/settings-dialog'],
        ['SettingsSection and SettingsRow', '/ui/settings/settings-section'],
        ['MasterDetail', '/ui/settings/master-detail'],
        ['ConfirmDialog', '/ui/settings/confirm-dialog']
    ]),
    group('Formatting', [
        ['Format source', '/ui/formatting/'],
        ['Numbers', '/ui/formatting/numbers'],
        ['Dates and times', '/ui/formatting/dates'],
        ['Durations', '/ui/formatting/durations'],
        ['Regions', '/ui/formatting/regions']
    ]),
    group('Hooks', [
        ['useAsyncAction', '/ui/hooks/use-async-action'],
        ['useColumnResize', '/ui/hooks/use-column-resize'],
        ['useContentSize', '/ui/hooks/use-content-size'],
        ['useNow', '/ui/hooks/use-now']
    ]),
    group('Utilities', [
        ['UIProvider', '/ui/utilities/ui-provider'],
        ['Shortcuts', '/ui/utilities/shortcuts'],
        ['Lazy loading', '/ui/utilities/lazy-loading'],
        ['Clipboard and selection', '/ui/utilities/clipboard'],
        ['Floating layers', '/ui/utilities/floating-layers'],
        ['Error messages', '/ui/utilities/error-messages'],
        ['Testing', '/ui/utilities/testing']
    ])
];

const desktopShell: DefaultTheme.SidebarItem[] = [
    group('Shell', [
        ['Overview', '/shell/'],
        ['Application menu', '/shell/menu'],
        ['Updater', '/shell/updater'],
        ['Windows', '/shell/windows'],
        ['Window state', '/shell/window-state'],
        ['Theme', '/shell/theme'],
        ['Web guards', '/shell/web-guards'],
        ['Bridge', '/shell/bridge']
    ])
];

const terminal: DefaultTheme.SidebarItem[] = [group('Terminal', [['TerminalView', '/terminal/']])];

const database: DefaultTheme.SidebarItem[] = [
    group('Database', [
        ['Overview', '/database/'],
        ['Getting started', '/database/guide/getting-started'],
        ['Security', '/database/guide/security'],
        ['Protocol', '/database/guide/protocol']
    ]),
    group('Views', [
        ['ConnectionManager', '/database/views/connection-manager'],
        ['DatabaseExplorer', '/database/views/explorer'],
        ['TableView', '/database/views/table-view'],
        ['StructureView', '/database/views/structure-view'],
        ['QueryConsole', '/database/views/query-console']
    ]),
    group('API', [
        ['Client', '/database/api/client'],
        ['Host', '/database/api/host'],
        ['Testing', '/database/api/testing']
    ])
];

export const sidebar: DefaultTheme.SidebarMulti = {
    '/guide/': guide,
    '/ui/': desktopUi,
    '/shell/': desktopShell,
    '/terminal/': terminal,
    '/database/': database
};
