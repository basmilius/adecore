import { readFile, symlink, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { isNotFound } from '@adecore/utils/errors';
import { writeAtomic } from '@adecore/utils/fs';
import type { ProviderShare } from '../provider.ts';
import { existing } from './shadow-home.ts';

/*
 * What an extra account shares with the default account of the same CLI: a closed list of entries it
 * links and the keys of one settings file it copies once. Nothing outside `ProviderShare` is ever
 * named here, so a login, a history or whatever the CLI adds later cannot end up shared.
 */

export interface SharedConfigReport {
    linked: string[];
    // Entries of the account in the way of a link: a real file or a link somewhere else. Left alone.
    unshared: string[];
    // Whether the settings file was written from the keys of the default account.
    seeded: boolean;
}

/* Whether a settings file holds nothing but what the host wrote there, so the copy may take its place. */
export type OwnsSettings = (config: unknown) => boolean;

async function readJson(path: string): Promise<unknown> {
    try {
        return JSON.parse(await readFile(path, 'utf8'));
    } catch (e) {
        if (isNotFound(e) || e instanceof SyntaxError) {
            return undefined;
        }

        throw e;
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/*
 * Copies the listed keys of the default account's settings into the account's own file, when that file
 * is missing or holds nothing of the person's. Any other file stays: it is the account's now.
 */
async function seedSettings(from: string, into: string, share: ProviderShare, ownsSettings: OwnsSettings): Promise<boolean> {
    const { file, keys } = share.seed;
    const source = await readJson(join(from, file));

    if (!isObject(source)) {
        return false;
    }

    const seed = Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));

    if (Object.keys(seed).length === 0) {
        return false;
    }

    const path = join(into, file);

    const found = await existing(path);

    // A link is the person's own arrangement, and a write would replace it by a file.
    if (found.kind === 'link' || (found.kind === 'real' && !ownsSettings(await readJson(path)))) {
        return false;
    }

    await writeAtomic(path, `${JSON.stringify(seed, null, 2)}\n`, 0o600);

    return true;
}

/*
 * Links every shared entry the default folder `from` has into the account's folder `into` and seeds
 * its settings. Never overwrites a file and never creates anything in `from`, so it runs again
 * whenever it likes and picks up what the default account gained since.
 */
export async function applySharedConfig(
    from: string,
    into: string,
    share: ProviderShare,
    ownsSettings: OwnsSettings = () => false
): Promise<SharedConfigReport> {
    const shared = resolve(from);
    const own = resolve(into);
    const report: SharedConfigReport = { linked: [], unshared: [], seeded: false };

    if (shared === own) {
        return report;
    }

    for (const name of share.links) {
        const target = join(shared, name);

        if ((await existing(target)).kind === 'missing') {
            continue;
        }

        const link = join(own, name);
        const found = await existing(link);

        if (found.kind === 'missing') {
            await symlink(target, link);
            report.linked.push(name);
        } else if (found.kind === 'real' || resolve(own, found.target) !== target) {
            report.unshared.push(name);
        }
    }

    report.seeded = await seedSettings(shared, own, share, ownsSettings);

    return report;
}

/* Removes the links `applySharedConfig` made, and only those; a real file, another link and the copied settings stay. */
export async function removeSharedConfig(from: string, into: string, share: ProviderShare): Promise<string[]> {
    const shared = resolve(from);
    const own = resolve(into);
    const removed: string[] = [];

    for (const name of share.links) {
        const link = join(own, name);
        const found = await existing(link);

        if (found.kind === 'link' && resolve(own, found.target) === join(shared, name)) {
            await unlink(link);
            removed.push(name);
        }
    }

    return removed;
}
