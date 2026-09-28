import type { DefaultTheme } from 'vitepress';

const group = (text: string, items: [string, string][]): DefaultTheme.SidebarItem => ({
    text,
    collapsed: false,
    items: items.map(([label, link]) => ({ text: label, link }))
});

export const navigation: DefaultTheme.SidebarItem[] = [
    group('Guide', [
        ['Getting started', '/guide/getting-started'],
        ['Principles', '/guide/principles'],
        ['Theme', '/guide/theme']
    ]),
    group('Actions', [
        ['Button', '/actions/button'],
        ['IconButton', '/actions/icon-button'],
        ['ButtonGroup', '/actions/button-group'],
        ['CloseButton', '/actions/close-button'],
        ['Pill', '/actions/pill'],
        ['Tile', '/actions/tile']
    ]),
    group('Inputs', [
        ['Field', '/inputs/field'],
        ['Input and TextArea', '/inputs/input'],
        ['Select', '/inputs/select'],
        ['Switch', '/inputs/switch'],
        ['Segmented', '/inputs/segmented'],
        ['Stepper', '/inputs/stepper'],
        ['ChoiceCards', '/inputs/choice-cards'],
        ['IconPicker', '/inputs/icon-picker'],
        ['ColorSwatch', '/inputs/color-swatch'],
        ['AccentSwatches', '/inputs/accent-swatches']
    ]),
    group('Overlays', [
        ['Menu', '/overlays/menu'],
        ['ContextMenu', '/overlays/context-menu'],
        ['Dialog', '/overlays/dialog'],
        ['PromptDialog', '/overlays/prompt-dialog'],
        ['Popover', '/overlays/popover'],
        ['PreviewCard', '/overlays/preview-card'],
        ['Tooltip', '/overlays/tooltip'],
        ['DisabledReason', '/overlays/disabled-reason'],
        ['TextMenu', '/overlays/text-menu'],
        ['Toasts', '/overlays/toasts']
    ]),
    group('Display', [
        ['Kbd, KeyCap and Keys', '/display/kbd'],
        ['ShortcutHints', '/display/shortcut-hints'],
        ['Icon', '/display/icon'],
        ['FileIcon', '/display/file-icon'],
        ['SectionLabel', '/display/section-label'],
        ['Surface', '/display/surface'],
        ['ListRow', '/display/list-row'],
        ['PanelHeader', '/display/panel-header'],
        ['Separator', '/display/separator'],
        ['Skeleton', '/display/skeleton'],
        ['Spinner', '/display/spinner'],
        ['EmptyState', '/display/empty-state'],
        ['PanelEmpty', '/display/panel-empty'],
        ['Banner', '/display/banner'],
        ['ErrorBoundary', '/display/error-boundary']
    ]),
    group('Layout', [
        ['SlidingColumn', '/layout/sliding-column'],
        ['ColumnResizeHandle', '/layout/column-resize-handle'],
        ['DockShell', '/layout/dock-shell'],
        ['ZoomControls', '/layout/zoom-controls'],
        ['Wipe', '/layout/wipe']
    ]),
    group('Settings', [
        ['SettingsDialog', '/settings/settings-dialog'],
        ['SettingsSection and SettingsRow', '/settings/settings-section'],
        ['MasterDetail', '/settings/master-detail'],
        ['ConfirmDialog', '/settings/confirm-dialog']
    ]),
    group('Formatting', [
        ['Format source', '/formatting/'],
        ['Numbers', '/formatting/numbers'],
        ['Dates and times', '/formatting/dates'],
        ['Durations', '/formatting/durations'],
        ['Regions', '/formatting/regions']
    ]),
    group('Hooks', [
        ['useAsyncAction', '/hooks/use-async-action'],
        ['useColumnResize', '/hooks/use-column-resize'],
        ['useContentSize', '/hooks/use-content-size'],
        ['useNow', '/hooks/use-now']
    ]),
    group('Utilities', [
        ['UIProvider', '/utilities/ui-provider'],
        ['Shortcuts', '/utilities/shortcuts'],
        ['Lazy loading', '/utilities/lazy-loading'],
        ['Clipboard and selection', '/utilities/clipboard'],
        ['Floating layers', '/utilities/floating-layers'],
        ['Error messages', '/utilities/error-messages'],
        ['Testing', '/utilities/testing']
    ])
];
