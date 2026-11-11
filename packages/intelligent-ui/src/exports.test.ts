import { describePublicApi } from '../../../scripts/public-api.ts';

await describePublicApi({
    url: import.meta.url,
    entries: {
        '.': 'index.ts',
        './links': 'links.ts',
        './query': 'query.ts',
        './catalog': 'catalog.ts',
        './event-time': 'event-time.ts',
        './budget': 'budget.ts',
        './expression': 'expression.ts',
        './syntax': 'syntax.ts',
        './compiler': 'compiler.ts',
        './runtime': 'runtime.ts',
        './protocol': 'protocol.ts',
        './text': 'text.ts',
        './stream': 'stream.ts'
    }
});
