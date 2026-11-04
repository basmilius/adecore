import type { DefaultTheme } from 'vitepress';

function group(text: string, items: [string, string][]): DefaultTheme.SidebarItem {
    return {
        text,
        collapsed: false,
        items: items.map(([label, link]) => ({ text: label, link }))
    };
}

/* The packages by area, as `[label, folder]`, in the order the nav and the guide list them. */
const PACKAGES: [string, [string, string][]][] = [
    [
        'Interface',
        [
            ['UI', 'ui'],
            ['Charts', 'charts'],
            ['Terminal', 'terminal']
        ]
    ],
    [
        'Agents',
        [
            ['Agent contracts', 'agent-contracts'],
            ['Agents', 'agents'],
            ['Agent views', 'agents-react'],
            ['Intelligent UI', 'intelligent-ui']
        ]
    ],
    [
        'Editor',
        [
            ['Editor core', 'editor-core'],
            ['Editor', 'editor'],
            ['Editor views', 'editor-react'],
            ['LSP', 'lsp'],
            ['Merge', 'merge']
        ]
    ],
    [
        'Platform',
        [
            ['Shell', 'shell'],
            ['Service', 'service'],
            ['Database', 'database'],
            ['Utils', 'utils']
        ]
    ],
    [
        'Canvas',
        [
            ['Drawing', 'drawing'],
            ['Diagram', 'diagram'],
            ['Plan', 'plan']
        ]
    ]
];

/* The reference page of each package that has one, until every package has its generated export table. */
const REFERENCES: Record<string, string> = {
    'agent-contracts': '/agent-contracts/reference',
    agents: '/agents/reference',
    'agents-react': '/agents-react/reference',
    'intelligent-ui': '/intelligent-ui/reference',
    'editor-core': '/editor-core/api',
    editor: '/editor/reference',
    'editor-react': '/editor-react/reference',
    lsp: '/lsp/reference',
    terminal: '/terminal/reference',
    utils: '/utils/reference',
    database: '/database/api/client'
};

const folders = PACKAGES.flatMap(([, packages]) => packages.map(([, folder]) => folder));

export const nav: DefaultTheme.NavItem[] = [
    { text: 'Guide', link: '/guide/', activeMatch: '^/guide/' },
    {
        text: 'Packages',
        activeMatch: `^/(${folders.join('|')})/`,
        items: [
            { text: 'Choosing packages', link: '/guide/packages' },
            ...PACKAGES.map(([area, packages]) => ({
                text: area,
                items: packages.map(([label, folder]) => ({ text: label, link: `/${folder}/` }))
            }))
        ]
    },
    { text: 'Reference', link: '/reference/', activeMatch: '^/reference/' }
];

const guide: DefaultTheme.SidebarItem[] = [
    group('Guide', [
        ['Introduction', '/guide/'],
        ['Choosing packages', '/guide/packages'],
        ['Installing', '/guide/installing'],
        ['Styles', '/guide/styles'],
        ['React Compiler', '/guide/react-compiler']
    ])
];

const reference: DefaultTheme.SidebarItem[] = [
    group('Reference', [['All packages', '/reference/']]),
    ...PACKAGES.map(([area, packages]) =>
        group(
            area,
            packages.filter(([, folder]) => REFERENCES[folder] !== undefined).map(([label, folder]): [string, string] => [label, REFERENCES[folder]!])
        )
    ).filter((item) => item.items!.length > 0)
];

const desktopUi: DefaultTheme.SidebarItem[] = [
    group('UI', [
        ['Overview', '/ui/'],
        ['Getting started', '/ui/guide/getting-started'],
        ['Principles', '/ui/guide/principles'],
        ['Theme', '/ui/guide/theme']
    ]),
    group('Actions', [
        ['Button', '/ui/actions/button'],
        ['ButtonGroup', '/ui/actions/button-group'],
        ['CloseButton', '/ui/actions/close-button'],
        ['CopyButton', '/ui/actions/copy-button'],
        ['IconButton', '/ui/actions/icon-button'],
        ['Pill', '/ui/actions/pill'],
        ['SplitButton', '/ui/actions/split-button'],
        ['Tile', '/ui/actions/tile']
    ]),
    group('Inputs', [
        ['Checkbox', '/ui/inputs/checkbox'],
        ['ChoiceCards', '/ui/inputs/choice-cards'],
        ['Combobox', '/ui/inputs/combobox'],
        ['Field', '/ui/inputs/field'],
        ['Input and TextArea', '/ui/inputs/input'],
        ['Segmented', '/ui/inputs/segmented'],
        ['Select', '/ui/inputs/select'],
        ['Slider', '/ui/inputs/slider'],
        ['Stepper', '/ui/inputs/stepper'],
        ['Switch', '/ui/inputs/switch']
    ]),
    group('Pickers', [
        ['AccentSwatches', '/ui/pickers/accent-swatches'],
        ['ColorSwatch', '/ui/pickers/color-swatch'],
        ['ColorWheelPicker', '/ui/pickers/color-wheel-picker'],
        ['IconPicker', '/ui/pickers/icon-picker']
    ]),
    group('Menus', [
        ['CommandPalette', '/ui/menus/command-palette'],
        ['ContextMenu', '/ui/menus/context-menu'],
        ['Menu', '/ui/menus/menu'],
        ['ProjectSwitcher', '/ui/menus/project-switcher'],
        ['TextMenu', '/ui/menus/text-menu']
    ]),
    group('Overlays', [
        ['ConfirmDialog', '/ui/overlays/confirm-dialog'],
        ['Dialog', '/ui/overlays/dialog'],
        ['DisabledReason', '/ui/overlays/disabled-reason'],
        ['Popover', '/ui/overlays/popover'],
        ['PreviewCard', '/ui/overlays/preview-card'],
        ['PromptDialog', '/ui/overlays/prompt-dialog'],
        ['Tooltip', '/ui/overlays/tooltip']
    ]),
    group('Display', [
        ['FileIcon', '/ui/display/file-icon'],
        ['Icon', '/ui/display/icon'],
        ['Kbd, KeyCap and Keys', '/ui/display/kbd'],
        ['KeyValueList', '/ui/display/key-value-list'],
        ['ListRow', '/ui/display/list-row'],
        ['MiddleTruncate', '/ui/display/middle-truncate'],
        ['PanelHeader', '/ui/display/panel-header'],
        ['RelativeTime', '/ui/display/relative-time'],
        ['SectionLabel', '/ui/display/section-label'],
        ['Separator', '/ui/display/separator'],
        ['ShortcutHints', '/ui/display/shortcut-hints'],
        ['Surface', '/ui/display/surface']
    ]),
    group('Status', [
        ['Banner', '/ui/status/banner'],
        ['EmptyState', '/ui/status/empty-state'],
        ['ErrorBoundary', '/ui/status/error-boundary'],
        ['Meter', '/ui/status/meter'],
        ['PanelEmpty', '/ui/status/panel-empty'],
        ['SegmentBar', '/ui/status/segment-bar'],
        ['Skeleton', '/ui/status/skeleton'],
        ['Spinner', '/ui/status/spinner'],
        ['Toasts', '/ui/status/toasts'],
        ['Waveform', '/ui/status/waveform']
    ]),
    group('Trees', [
        ['FileTree', '/ui/trees/file-tree'],
        ['Models, loading and expansion', '/ui/trees/file-tree/models-loading'],
        ['Interaction and row controls', '/ui/trees/file-tree/interaction-controls'],
        ['FileTree reference', '/ui/trees/file-tree/reference'],
        ['Tree', '/ui/trees/tree'],
        ['Tree reference', '/ui/trees/tree/reference']
    ]),
    group('Layout', [
        ['ColumnResizeHandle', '/ui/layout/column-resize-handle'],
        ['DockShell', '/ui/layout/dock-shell'],
        ['ScrollArea', '/ui/layout/scroll-area'],
        ['SlidingColumn', '/ui/layout/sliding-column'],
        ['SplitView', '/ui/layout/split-view'],
        ['TabStrip', '/ui/layout/tab-strip'],
        ['Tabs', '/ui/layout/tabs'],
        ['Wipe', '/ui/layout/wipe'],
        ['Workspace', '/ui/layout/workspace'],
        ['ZoomControls', '/ui/layout/zoom-controls']
    ]),
    group('Settings', [
        ['MasterDetail', '/ui/settings/master-detail'],
        ['SettingsDialog', '/ui/settings/settings-dialog'],
        ['SettingsSection and SettingsRow', '/ui/settings/settings-section']
    ]),
    group('Foundations', [
        ['Clipboard and selection', '/ui/utilities/clipboard'],
        ['Error messages', '/ui/utilities/error-messages'],
        ['Floating layers', '/ui/utilities/floating-layers'],
        ['Lazy loading', '/ui/utilities/lazy-loading'],
        ['Shortcuts', '/ui/utilities/shortcuts'],
        ['UIProvider', '/ui/utilities/ui-provider']
    ]),
    group('Formatting', [
        ['Format source', '/ui/formatting/'],
        ['Dates and times', '/ui/formatting/dates'],
        ['Durations', '/ui/formatting/durations'],
        ['Numbers', '/ui/formatting/numbers'],
        ['Regions', '/ui/formatting/regions']
    ]),
    group('Hooks', [
        ['useAsyncAction', '/ui/hooks/use-async-action'],
        ['useColumnResize', '/ui/hooks/use-column-resize'],
        ['useContentSize', '/ui/hooks/use-content-size'],
        ['useNow', '/ui/hooks/use-now'],
        ['useOverlayScrollbars', '/ui/hooks/use-overlay-scrollbars']
    ]),
    group('Testing', [['Testing', '/ui/utilities/testing']])
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
        ['App scheme', '/shell/app-scheme'],
        ['Bridge', '/shell/bridge']
    ])
];

const terminal: DefaultTheme.SidebarItem[] = [
    group('Terminal', [
        ['Overview', '/terminal/'],
        ['Getting started', '/terminal/getting-started']
    ]),
    group('Guides', [
        ['Input and output', '/terminal/input-output'],
        ['Theme and font', '/terminal/theme'],
        ['Links', '/terminal/links'],
        ['WebGL', '/terminal/webgl'],
        ['Going past the props', '/terminal/xterm']
    ]),
    group('Reference', [['Props, handle and exports', '/terminal/reference']])
];

const utils: DefaultTheme.SidebarItem[] = [
    group('Utils', [['Overview', '/utils/']]),
    group('Page or Node', [
        ['Async', '/utils/async'],
        ['Errors', '/utils/errors'],
        ['Records', '/utils/record'],
        ['Text', '/utils/text']
    ]),
    group('Node or Bun', [
        ['Files', '/utils/fs'],
        ['Paths', '/utils/path']
    ]),
    group('Reference', [['Exports', '/utils/reference']])
];

const charts: DefaultTheme.SidebarItem[] = [
    group('Charts', [
        ['Overview', '/charts/'],
        ['Series chart', '/charts/series'],
        ['Columns and groups', '/charts/columns'],
        ['Scatter and series legend', '/charts/scatter'],
        ['Shared cursor', '/charts/shared-cursor'],
        ['Sparkline', '/charts/sparkline'],
        ['Heatmap', '/charts/heatmap'],
        ['Timeline', '/charts/timeline'],
        ['useChart', '/charts/use-chart']
    ])
];

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
        ['DatabaseWorkbench', '/database/views/workbench'],
        ['DataGrid', '/database/views/data-grid']
    ]),
    group('API', [
        ['Client', '/database/api/client'],
        ['Host', '/database/api/host'],
        ['Testing', '/database/api/testing']
    ])
];

export const sidebar: DefaultTheme.SidebarMulti = {
    '/guide/': guide,
    '/reference/': reference,
    '/ui/': desktopUi,
    '/shell/': desktopShell,
    '/terminal/': terminal,
    '/charts/': charts,
    '/database/': database,
    '/agent-contracts/': [
        group('Agent contracts', [
            ['Overview', '/agent-contracts/'],
            ['Protocol', '/agent-contracts/protocol'],
            ['Conversation', '/agent-contracts/conversation'],
            ['Visuals', '/agent-contracts/visuals'],
            ['Providers and accounts', '/agent-contracts/providers-and-accounts'],
            ['Tasks and usage', '/agent-contracts/tasks-and-usage']
        ]),
        group('Reference', [['Exports', '/agent-contracts/reference']])
    ],
    '/agents/': [
        group('Agents', [
            ['Overview', '/agents/'],
            ['Getting started', '/agents/getting-started'],
            ['Host', '/agents/host'],
            ['Chats and turns', '/agents/chats'],
            ['Providers', '/agents/providers'],
            ['ACP agents', '/agents/acp'],
            ['Accounts and usage', '/agents/accounts'],
            ['Coordination', '/agents/coordination'],
            ['Tools', '/agents/tools'],
            ['Storage', '/agents/storage'],
            ['Testing', '/agents/testing']
        ]),
        group('Reference', [['Exports', '/agents/reference']])
    ],
    '/intelligent-ui/': [
        group('Intelligent UI', [
            ['Overview', '/intelligent-ui/'],
            ['Getting started', '/intelligent-ui/guide/getting-started'],
            ['Security model', '/intelligent-ui/guide/security']
        ]),
        group('Language', [
            ['Syntax', '/intelligent-ui/language/syntax'],
            ['Expressions', '/intelligent-ui/language/expressions'],
            ['State and inputs', '/intelligent-ui/language/state']
        ]),
        group('Components', [
            ['Status', '/intelligent-ui/components/status'],
            ['Data', '/intelligent-ui/components/data'],
            ['Structure', '/intelligent-ui/components/structure'],
            ['Content', '/intelligent-ui/components/content'],
            ['Places', '/intelligent-ui/components/places'],
            ['Host links', '/intelligent-ui/components/links'],
            ['Inputs', '/intelligent-ui/components/inputs'],
            ['Choices', '/intelligent-ui/components/choices']
        ]),
        group('Host integration', [
            ['Live queries', '/intelligent-ui/host/queries'],
            ['Choices', '/intelligent-ui/host/choices'],
            ['Links', '/intelligent-ui/host/links'],
            ['Compilation and streaming', '/intelligent-ui/host/compilation'],
            ['Performance', '/intelligent-ui/performance']
        ]),
        group('Reference', [['Exports', '/intelligent-ui/reference']])
    ],
    '/agents-react/': [
        group('Agent views', [
            ['Overview', '/agents-react/'],
            ['Getting started', '/agents-react/guide/getting-started'],
            ['Host adapters', '/agents-react/guide/host'],
            ['Chat client and state', '/agents-react/guide/chat-client'],
            ['Persistence', '/agents-react/guide/persistence'],
            ['Testing', '/agents-react/guide/testing']
        ]),
        group('Chat', [
            ['Timeline', '/agents-react/chat/timeline'],
            ['Composer', '/agents-react/chat/composer'],
            ['Prompts', '/agents-react/chat/prompts'],
            ['Messages and code', '/agents-react/chat/messages'],
            ['Diffs', '/agents-react/chat/diffs'],
            ['Subagents', '/agents-react/chat/subagents'],
            ['Limits', '/agents-react/chat/limits'],
            ['Chat parts', '/agents-react/chat/parts'],
            ['Attachments and mentions', '/agents-react/chat/attachments'],
            ['Intelligent UI', '/agents-react/chat/intelligent-ui'],
            ['Visuals', '/agents-react/chat/visuals']
        ]),
        group('Providers', [
            ['ProvidersPane', '/agents-react/providers/providers-pane'],
            ['Model picker', '/agents-react/providers/model-picker'],
            ['Agent marks', '/agents-react/providers/marks']
        ]),
        group('Usage', [
            ['UsagePage', '/agents-react/usage/usage-page'],
            ['Charts and tiles', '/agents-react/usage/charts'],
            ['Plan limits', '/agents-react/usage/limits']
        ]),
        group('Reference', [['Exports', '/agents-react/reference']])
    ],
    '/utils/': utils,
    '/merge/': [
        group('Merge', [
            ['Overview', '/merge/'],
            ['Lines and diffs', '/merge/lines'],
            ['Three-way merge', '/merge/three-way']
        ])
    ],
    '/drawing/': [
        group('Drawing', [
            ['Overview', '/drawing/'],
            ['Documents', '/drawing/documents'],
            ['Geometry', '/drawing/geometry'],
            ['Paths and SVG', '/drawing/rendering'],
            ['Text and reading order', '/drawing/text']
        ])
    ],
    '/diagram/': [
        group('Diagram', [
            ['Overview', '/diagram/'],
            ['Documents', '/diagram/documents'],
            ['Layout', '/diagram/layout'],
            ['Painting and reading', '/diagram/rendering']
        ])
    ],
    '/plan/': [
        group('Plan', [
            ['Overview', '/plan/'],
            ['Plans', '/plan/plans'],
            ['Operations', '/plan/operations'],
            ['Markdown and text', '/plan/markdown']
        ])
    ],
    '/service/': [
        group('Service', [
            ['Overview', '/service/'],
            ['Definitions', '/service/definitions'],
            ['Managers', '/service/managers']
        ])
    ],
    '/editor-core/': [
        group('Editor core', [
            ['Overview', '/editor-core/'],
            ['Documents and edits', '/editor-core/documents'],
            ['Typing and commands', '/editor-core/commands'],
            ['Search and folding', '/editor-core/search-folding']
        ]),
        group('Reference', [['Exports', '/editor-core/api']])
    ],
    '/editor/': [
        group('Editor', [
            ['Overview', '/editor/'],
            ['Getting started', '/editor/getting-started'],
            ['Options and keymaps', '/editor/options'],
            ['Text and events', '/editor/editing'],
            ['Theme and syntax', '/editor/theme'],
            ['Testing', '/editor/testing']
        ]),
        group('Rendering', [
            ['Decorations', '/editor/decorations'],
            ['Rows and widgets', '/editor/rows'],
            ['Agents', '/editor/agents'],
            ['Find and folding', '/editor/find-folding']
        ]),
        group('Reference', [['Exports', '/editor/reference']])
    ],
    '/lsp/': [
        group('LSP', [
            ['Overview', '/lsp/'],
            ['Sessions and transports', '/lsp/sessions'],
            ['Documents and edits', '/lsp/documents'],
            ['Language service', '/lsp/language-service'],
            ['Testing', '/lsp/testing']
        ]),
        group('Reference', [['Exports', '/lsp/reference']])
    ],
    '/editor-react/': [
        group('Editor views', [
            ['Overview', '/editor-react/'],
            ['Getting started', '/editor-react/getting-started'],
            ['Projects and documents', '/editor-react/project'],
            ['View state', '/editor-react/view-state'],
            ['Testing', '/editor-react/testing']
        ]),
        group('Views', [
            ['EditorView', '/editor-react/editor-view'],
            ['Completion and signatures', '/editor-react/completion'],
            ['Hover and problems', '/editor-react/hover'],
            ['Navigation', '/editor-react/navigation'],
            ['Call hierarchy', '/editor-react/call-hierarchy'],
            ['Rename and code actions', '/editor-react/rename'],
            ['Format on type', '/editor-react/format-on-type'],
            ['Markup', '/editor-react/markup'],
            ['Templates', '/editor-react/templates'],
            ['Links, colors and more', '/editor-react/language-features'],
            ['FindReplace', '/editor-react/find-replace'],
            ['Reviews and agents', '/editor-react/change-review'],
            ['Patch files', '/editor-react/patch-files'],
            ['Code vision', '/editor-react/code-vision'],
            ['Rendered documentation', '/editor-react/rendered-documentation']
        ]),
        group('Reference', [
            ['Models', '/editor-react/models'],
            ['Exports', '/editor-react/reference']
        ])
    ]
};
