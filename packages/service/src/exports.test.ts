import { describePublicApi } from '../../../scripts/public-api.ts';

await describePublicApi({
    url: import.meta.url,
    entries: {
        '.': 'index.ts',
        './definitions': 'definitions.ts',
        './manager': 'manager.ts',
        './platform': 'platform.ts',
        './system': 'system.ts'
    }
});
