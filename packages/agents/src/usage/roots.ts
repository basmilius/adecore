import { join } from 'node:path';
import type { UsageProvider } from '@adecore/agent-contracts';
import { homeFolder } from '../home-folder.ts';

export interface UsageRootPath {
    provider: UsageProvider;
    path: string;
    /* The accounts whose CLI writes here, by id, the default one under its kind; absent is the default account alone. */
    accounts?: string[];
}

/* Where in its config folder each CLI leaves its transcripts. A provider with no CLI has a log its host passes as a root of its own. */
const TRANSCRIPTS: Partial<Record<UsageProvider, string>> & Record<'claude' | 'codex' | 'grok', string> = {
    claude: 'projects',
    codex: 'sessions',
    grok: 'sessions'
};

/* The transcripts of the default accounts, found through the variables the CLIs themselves read. */
export function usageRoots(env: Record<string, string | undefined> = process.env): UsageRootPath[] {
    const home = homeFolder(env);

    return [
        { provider: 'claude', path: join(env.CLAUDE_CONFIG_DIR ?? join(home, '.claude'), TRANSCRIPTS.claude) },
        { provider: 'codex', path: join(env.CODEX_HOME ?? join(home, '.codex'), TRANSCRIPTS.codex) },
        { provider: 'grok', path: join(env.GROK_HOME ?? join(home, '.grok'), TRANSCRIPTS.grok) }
    ];
}

/* The transcripts of every account, once per folder: Codex accounts over one home share its sessions. */
export function accountRoots(folders: ReadonlyArray<{ id: string; kind: UsageProvider; folder: string }>): UsageRootPath[] {
    const roots = new Map<string, UsageRootPath & { accounts: string[] }>();

    for (const { id, kind, folder } of folders) {
        const transcripts = TRANSCRIPTS[kind];

        if (transcripts === undefined) {
            continue;
        }

        const path = join(folder, transcripts);
        const key = `${kind}\0${path}`;
        const root = roots.get(key);

        if (root === undefined) {
            roots.set(key, { provider: kind, path, accounts: [id] });
        } else {
            root.accounts.push(id);
        }
    }

    return [...roots.values()];
}
