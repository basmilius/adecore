import { describePublicApi } from '../../../scripts/public-api.ts';

await describePublicApi({
    url: import.meta.url,
    entries: {
        '.': 'index.ts',
        './chat': 'chat/index.ts',
        './chat/ui': 'chat/ui/index.ts',
        './images': 'images.ts',
        './prompts': 'chat/prompts/index.ts',
        './providers': 'providers/index.ts',
        './state': 'state/index.ts',
        './testing': 'testing/index.ts',
        './usage': 'usage/index.ts',
        './locales': 'locales.ts'
    },
    assets: ['./locales/*', './theme.css']
});
