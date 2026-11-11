import { describePublicApi } from '../../../scripts/public-api.ts';

await describePublicApi({
    url: import.meta.url,
    entries: {
        '.': 'index.ts',
        './protocol': 'protocol/index.ts',
        './host': 'host/index.ts',
        './testing': 'testing/index.ts'
    }
});
