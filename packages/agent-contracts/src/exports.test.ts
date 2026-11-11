import { describePublicApi } from '../../../scripts/public-api.ts';

await describePublicApi({
    url: import.meta.url,
    entries: {
        '.': 'index.ts',
        './agent': 'agent.ts',
        './chat': 'chat.ts',
        './envelope': 'envelope.ts',
        './ids': 'ids.ts',
        './model': 'model.ts',
        './port': 'port.ts',
        './protocol': 'protocol.ts',
        './provider-accounts': 'provider-accounts.ts',
        './task': 'task.ts',
        './text': 'text.ts',
        './usage': 'usage.ts',
        './visual': 'visual.ts',
        './worktree': 'worktree.ts'
    }
});
