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
    group('FileTree', [
        ['Overview', '/ui/display/file-tree'],
        ['Getting started', '/ui/display/file-tree/getting-started'],
        ['Models, loading and expansion', '/ui/display/file-tree/models-loading'],
        ['Interaction and row controls', '/ui/display/file-tree/interaction-controls'],
        ['Reference and migration', '/ui/display/file-tree/reference']
    ]),
    group('Tree', [
        ['Overview', '/ui/display/tree'],
        ['Getting started', '/ui/display/tree/getting-started'],
        ['Integrating a custom model', '/ui/display/tree/model-integration'],
        ['Part reference', '/ui/display/tree/reference']
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
        ['Connections', '/database/guide/connections'],
        ['Opening tables as tabs', '/database/guide/tabs'],
        ['Files', '/database/guide/files'],
        ['Security', '/database/guide/security'],
        ['Protocol', '/database/guide/protocol']
    ]),
    group('Views', [
        ['ConnectionManager', '/database/views/connection-manager'],
        ['DatabaseExplorer', '/database/views/explorer'],
        ['TableView', '/database/views/table-view'],
        ['StructureView', '/database/views/structure-view'],
        ['TableDesigner', '/database/views/table-designer'],
        ['QueryConsole', '/database/views/query-console'],
        ['DatabaseWorkbench', '/database/views/workbench']
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
    '/database/': database,
    '/agent-contracts/': [
        group('Agent contracts', [
            ['Overview', '/agent-contracts/'],
            ['Getting started', '/agent-contracts/getting-started'],
            ['Frames and events', '/agent-contracts/frames-and-events'],
            ['Conversation content', '/agent-contracts/conversation'],
            ['Providers and accounts', '/agent-contracts/providers-and-accounts'],
            ['Tasks and usage', '/agent-contracts/tasks-and-usage'],
            ['Validation and compatibility', '/agent-contracts/validation-and-compatibility']
        ])
    ],
    '/agents/': [
        group('Agents', [
            ['Overview', '/agents/'],
            ['Getting started', '/agents/getting-started'],
            ['Transport', '/agents/transport'],
            ['Host integration', '/agents/host-integration'],
            ['Providers and models', '/agents/providers-and-models'],
            ['Turns and requests', '/agents/turns-and-requests'],
            ['Accounts and environment', '/agents/accounts-and-environment'],
            ['Durable coordination', '/agents/coordination'],
            ['Context commands', '/agents/context-commands'],
            ['Persistence and helpers', '/agents/persistence-and-helpers'],
            ['Testing and troubleshooting', '/agents/testing-and-troubleshooting'],
            ['Public entrypoints', '/agents/entrypoints'],
            ['Migration', '/agents/migration']
        ])
    ],
    '/agents-react/': [
        group('Agent views', [
            ['Overview', '/agents-react/'],
            ['Installation and setup', '/agents-react/getting-started'],
            ['Host adapters', '/agents-react/host'],
            ['Chat state and lifecycle', '/agents-react/chat-lifecycle']
        ]),
        group('Chat', [
            ['Composer', '/agents-react/composer'],
            ['Attachments and mentions', '/agents-react/attachments'],
            ['Messages and timeline', '/agents-react/timeline'],
            ['Approvals and tasks', '/agents-react/approvals-tasks']
        ]),
        group('Providers and usage', [
            ['Accounts and models', '/agents-react/accounts-models'],
            ['Usage', '/agents-react/usage']
        ]),
        group('Integration', [
            ['Persistence', '/agents-react/persistence'],
            ['CSS, theme, and translations', '/agents-react/styling'],
            ['Testing', '/agents-react/testing'],
            ['Migration', '/agents-react/migration'],
            ['Troubleshooting', '/agents-react/troubleshooting']
        ]),
        group('Reference', [
            ['Runtime', '/agents-react/reference-runtime'],
            ['Chat', '/agents-react/reference-chat'],
            ['Settings', '/agents-react/reference-settings']
        ])
    ],
    '/merge/': [
        group('Merge', [
            ['Overview', '/merge/'],
            ['Getting started', '/merge/getting-started'],
            ['Lines, ranges and blocks', '/merge/concepts'],
            ['Choosing a resolution', '/merge/resolution'],
            ['API reference', '/merge/api'],
            ['Host integration and testing', '/merge/integration']
        ])
    ],
    '/drawing/': [
        group('Drawing', [
            ['Overview', '/drawing/'],
            ['Getting started', '/drawing/getting-started'],
            ['Geometry and editing', '/drawing/geometry'],
            ['Paths and SVG', '/drawing/rendering'],
            ['Text, fonts and reading order', '/drawing/text'],
            ['API reference', '/drawing/api'],
            ['Drawing protocol', '/drawing/protocol'],
            ['Integration, migration and testing', '/drawing/migration']
        ])
    ],
    '/diagram/': [
        group('Diagram', [
            ['Overview', '/diagram/'],
            ['Getting started', '/diagram/getting-started'],
            ['Layers, groups and layout', '/diagram/layout'],
            ['Painting and reading output', '/diagram/rendering'],
            ['API reference', '/diagram/api'],
            ['Diagram protocol', '/diagram/protocol'],
            ['Integration, migration and testing', '/diagram/migration']
        ])
    ],
    '/plan/': [
        group('Plan', [
            ['Overview', '/plan/'],
            ['Getting started', '/plan/getting-started'],
            ['Tree, state and progress', '/plan/concepts'],
            ['Operations and permissions', '/plan/operations'],
            ['Markdown and reading text', '/plan/formats'],
            ['API reference', '/plan/api'],
            ['Plan protocol', '/plan/protocol'],
            ['Integration, migration and testing', '/plan/migration']
        ])
    ],
    '/service/': [
        group('Service', [
            ['Overview', '/service/'],
            ['Getting started', '/service/getting-started'],
            ['Definitions and identity', '/service/definitions'],
            ['Lifecycle', '/service/lifecycle'],
            ['API reference', '/service/reference'],
            ['Testing and host migration', '/service/testing-migration']
        ])
    ],
    '/editor-core/': [
        group('Editor core', [
            ['Overview', '/editor-core/'],
            ['Handbook', '/editor-core/handbook/'],
            ['Text and selections', '/editor-core/handbook/document-model'],
            ['Transactions and history', '/editor-core/handbook/transactions'],
            ['Events and state', '/editor-core/handbook/events-state'],
            ['Commands and structure', '/editor-core/handbook/commands-structure'],
            ['Testing and provenance', '/editor-core/handbook/testing-provenance']
        ])
    ],
    '/editor/': [
        group('Editor', [
            ['Overview', '/editor/'],
            ['Handbook', '/editor/handbook/'],
            ['Configuration and keymaps', '/editor/handbook/configuration'],
            ['Editing and events', '/editor/handbook/editing'],
            ['Rendering and large files', '/editor/handbook/rendering'],
            ['Theme and syntax', '/editor/handbook/theme-syntax'],
            ['Search, folds and widgets', '/editor/handbook/search-widgets'],
            ['Testing and migration', '/editor/handbook/testing-migration'],
            ['Consumer migration', '/editor/migration']
        ])
    ],
    '/lsp/': [
        group('LSP', [
            ['Overview', '/lsp/'],
            ['Handbook', '/lsp/handbook/'],
            ['Transports and processes', '/lsp/handbook/transports'],
            ['Initialization and capabilities', '/lsp/handbook/initialization'],
            ['Documents and edits', '/lsp/handbook/documents-edits'],
            ['Requests and results', '/lsp/handbook/requests-features'],
            ['Vue and TypeScript', '/lsp/handbook/vue'],
            ['Testing and host integration', '/lsp/handbook/testing-host']
        ])
    ],
    '/editor-react/': [
        group('Editor React', [
            ['Overview', '/editor-react/'],
            ['Handbook', '/editor-react/handbook/'],
            ['Getting started', '/editor-react/handbook/getting-started'],
            ['Host integration', '/editor-react/handbook/host-integration'],
            ['Completion and information', '/editor-react/handbook/completion-information'],
            ['Diagnostics, tokens and hints', '/editor-react/handbook/diagnostics-tokens'],
            ['Navigation and changes', '/editor-react/handbook/navigation-changes'],
            ['Review and proposals', '/editor-react/handbook/review-proposals'],
            ['Lifecycle and testing', '/editor-react/handbook/lifecycle-testing']
        ])
    ],
    '/php-language-server/': [
        group('PHP language server', [
            ['Overview', '/php-language-server/'],
            ['Getting started', '/php-language-server/handbook/getting-started'],
            ['Distribution and native metadata', '/php-language-server/handbook/distribution'],
            ['Server and document lifecycle', '/php-language-server/handbook/lifecycle'],
            ['Configuration, Composer and stubs', '/php-language-server/handbook/configuration'],
            ['PHP features', '/php-language-server/handbook/features'],
            ['Frameworks and test support', '/php-language-server/handbook/frameworks'],
            ['Maintaining and validating', '/php-language-server/handbook/maintainers']
        ])
    ]
};
