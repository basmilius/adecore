import { describePublicApi } from '../../../scripts/public-api.ts';

await describePublicApi({
    url: import.meta.url,
    entries: {
        '.': 'index.ts',
        './models': 'models.ts',
        './testing': 'testing.ts',
        './snippet-transform-worker': 'snippet-transform-worker.ts'
    },
    assets: ['./editor-react.css', './locales/*']
});
