import { describePublicApi } from '../../../scripts/public-api.ts';

await describePublicApi({
    url: import.meta.url,
    entries: {
        './async': 'async.ts',
        './errors': 'errors.ts',
        './fs': 'fs.ts',
        './geometry': 'geometry.ts',
        './path': 'path.ts',
        './record': 'record.ts',
        './text': 'text.ts'
    }
});
