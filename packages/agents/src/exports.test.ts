import { describePublicApi } from '../../../scripts/public-api.ts';

await describePublicApi({
    url: import.meta.url,
    entries: {
        '.': 'index.ts',
        './chat': 'chat/index.ts',
        './context': 'context/index.ts',
        './coordination': 'coordination/index.ts',
        './host': 'host/index.ts',
        './providers': 'providers/index.ts',
        './testing': 'testing/index.ts',
        './usage': 'usage/index.ts',
        './testing/bin/fake-claude': 'testing/bin/fake-claude.ts',
        './testing/bin/fake-codex': 'testing/bin/fake-codex.ts'
    },
    assets: [
        './package.json',
        './providers/claude-models.json',
        './providers/codex-models.json',
        './providers/grok-models.json',
        './providers/copilot-models.json',
        './providers/antigravity-models.json',
        './testing/fixtures/*',
        './usage/prices-snapshot.json'
    ]
});
