import { describePublicApi } from '../../../scripts/public-api.ts';

await describePublicApi({
    url: import.meta.url,
    entries: {
        '.': 'index.ts',
        './fake': 'fake.ts',
        './shiki': 'shiki.ts',
        './shiki-worker': 'shiki-worker.ts',
        './keymap': 'keymap-table.ts',
        './testing': 'testing.ts',
        './search-worker': 'search-worker.ts',
        './worker-client': 'worker-client.ts'
    },
    assets: ['./editor.css']
});
