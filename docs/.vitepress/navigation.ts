import type { DefaultTheme } from 'vitepress';

const group = (text: string, items: [string, string][]): DefaultTheme.SidebarItem => ({
    text,
    collapsed: false,
    items: items.map(([label, link]) => ({ text: label, link }))
});

const guide: DefaultTheme.SidebarItem[] = [group('Guide', [['Introduction', '/guide/']])];

const desktopUi: DefaultTheme.SidebarItem[] = [
    group('Desktop UI', [
        ['Overview', '/desktop-ui/'],
        ['Getting started', '/desktop-ui/guide/getting-started'],
        ['Principles', '/desktop-ui/guide/principles'],
        ['Theme', '/desktop-ui/guide/theme']
    ]),
    group('Actions', [
        ['Button', '/desktop-ui/actions/button'],
        ['IconButton', '/desktop-ui/actions/icon-button'],
        ['ButtonGroup', '/desktop-ui/actions/button-group'],
        ['CloseButton', '/desktop-ui/actions/close-button'],
        ['Pill', '/desktop-ui/actions/pill'],
        ['Tile', '/desktop-ui/actions/tile']
    ]),
    group('Inputs', [
        ['Field', '/desktop-ui/inputs/field'],
        ['Input and TextArea', '/desktop-ui/inputs/input'],
        ['Select', '/desktop-ui/inputs/select'],
        ['Switch', '/desktop-ui/inputs/switch'],
        ['Checkbox', '/desktop-ui/inputs/checkbox'],
        ['Segmented', '/desktop-ui/inputs/segmented'],
        ['Stepper', '/desktop-ui/inputs/stepper'],
        ['ChoiceCards', '/desktop-ui/inputs/choice-cards'],
        ['IconPicker', '/desktop-ui/inputs/icon-picker'],
        ['ColorSwatch', '/desktop-ui/inputs/color-swatch'],
        ['AccentSwatches', '/desktop-ui/inputs/accent-swatches']
    ]),
    group('Overlays', [
        ['Menu', '/desktop-ui/overlays/menu'],
        ['ProjectSwitcher', '/desktop-ui/overlays/project-switcher'],
        ['ContextMenu', '/desktop-ui/overlays/context-menu'],
        ['Dialog', '/desktop-ui/overlays/dialog'],
        ['PromptDialog', '/desktop-ui/overlays/prompt-dialog'],
        ['Popover', '/desktop-ui/overlays/popover'],
        ['PreviewCard', '/desktop-ui/overlays/preview-card'],
        ['Tooltip', '/desktop-ui/overlays/tooltip'],
        ['DisabledReason', '/desktop-ui/overlays/disabled-reason'],
        ['TextMenu', '/desktop-ui/overlays/text-menu'],
        ['Toasts', '/desktop-ui/overlays/toasts']
    ]),
    group('Display', [
        ['Kbd, KeyCap and Keys', '/desktop-ui/display/kbd'],
        ['ShortcutHints', '/desktop-ui/display/shortcut-hints'],
        ['Icon', '/desktop-ui/display/icon'],
        ['FileIcon', '/desktop-ui/display/file-icon'],
        ['SectionLabel', '/desktop-ui/display/section-label'],
        ['Surface', '/desktop-ui/display/surface'],
        ['ListRow', '/desktop-ui/display/list-row'],
        ['PanelHeader', '/desktop-ui/display/panel-header'],
        ['Separator', '/desktop-ui/display/separator'],
        ['Skeleton', '/desktop-ui/display/skeleton'],
        ['Spinner', '/desktop-ui/display/spinner'],
        ['SegmentBar', '/desktop-ui/display/segment-bar'],
        ['Meter', '/desktop-ui/display/meter'],
        ['Waveform', '/desktop-ui/display/waveform'],
        ['EmptyState', '/desktop-ui/display/empty-state'],
        ['PanelEmpty', '/desktop-ui/display/panel-empty'],
        ['Banner', '/desktop-ui/display/banner'],
        ['ErrorBoundary', '/desktop-ui/display/error-boundary']
    ]),
    group('Layout', [
        ['SlidingColumn', '/desktop-ui/layout/sliding-column'],
        ['ColumnResizeHandle', '/desktop-ui/layout/column-resize-handle'],
        ['DockShell', '/desktop-ui/layout/dock-shell'],
        ['ZoomControls', '/desktop-ui/layout/zoom-controls'],
        ['Wipe', '/desktop-ui/layout/wipe']
    ]),
    group('Settings', [
        ['SettingsDialog', '/desktop-ui/settings/settings-dialog'],
        ['SettingsSection and SettingsRow', '/desktop-ui/settings/settings-section'],
        ['MasterDetail', '/desktop-ui/settings/master-detail'],
        ['ConfirmDialog', '/desktop-ui/settings/confirm-dialog']
    ]),
    group('Formatting', [
        ['Format source', '/desktop-ui/formatting/'],
        ['Numbers', '/desktop-ui/formatting/numbers'],
        ['Dates and times', '/desktop-ui/formatting/dates'],
        ['Durations', '/desktop-ui/formatting/durations'],
        ['Regions', '/desktop-ui/formatting/regions']
    ]),
    group('Hooks', [
        ['useAsyncAction', '/desktop-ui/hooks/use-async-action'],
        ['useColumnResize', '/desktop-ui/hooks/use-column-resize'],
        ['useContentSize', '/desktop-ui/hooks/use-content-size'],
        ['useNow', '/desktop-ui/hooks/use-now']
    ]),
    group('Utilities', [
        ['UIProvider', '/desktop-ui/utilities/ui-provider'],
        ['Shortcuts', '/desktop-ui/utilities/shortcuts'],
        ['Lazy loading', '/desktop-ui/utilities/lazy-loading'],
        ['Clipboard and selection', '/desktop-ui/utilities/clipboard'],
        ['Floating layers', '/desktop-ui/utilities/floating-layers'],
        ['Error messages', '/desktop-ui/utilities/error-messages'],
        ['Testing', '/desktop-ui/utilities/testing']
    ])
];

const desktopShell: DefaultTheme.SidebarItem[] = [
    group('Desktop Shell', [
        ['Overview', '/desktop-shell/'],
        ['Application menu', '/desktop-shell/menu'],
        ['Updater', '/desktop-shell/updater'],
        ['Windows', '/desktop-shell/windows'],
        ['Window state', '/desktop-shell/window-state'],
        ['Theme', '/desktop-shell/theme'],
        ['Web guards', '/desktop-shell/web-guards'],
        ['Bridge', '/desktop-shell/bridge']
    ])
];

export const sidebar: DefaultTheme.SidebarMulti = {
    '/guide/': guide,
    '/desktop-ui/': desktopUi,
    '/desktop-shell/': desktopShell
};
