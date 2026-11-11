import { describePublicApi } from '../../../scripts/public-api.ts';

await describePublicApi({
    url: import.meta.url,
    entries: {
        '.': 'index.ts',
        './settings': 'settings/index.ts',
        './format': 'format/index.ts',
        './testing': 'testing/index.ts',
        './testing/dedupe': 'testing/dedupe.ts',
        './design-conventions': 'design-conventions.ts'
    },
    assets: ['./theme.css'],
    compounds: ['Combobox', 'CommandPalette', 'ContextMenu', 'Dialog', 'FileTree', 'Tree', 'KeyValueList', 'Menu', 'Popover', 'PreviewCard', 'Table', 'Tabs']
});
