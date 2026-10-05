import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoverPackages } from '../../scripts/workspaces.ts';
import { exportTargets } from '../../scripts/packed-artifacts.ts';

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function librarySourceAliases(): { find: RegExp; replacement: string }[] {
    return discoverPackages()
        .flatMap(({ directory, manifest }) =>
            exportTargets(manifest).map((target) => ({
                find: new RegExp(`^${(manifest.name + target.subpath.slice(1)).split('*').map(escapeRegExp).join('(.*)')}$`),
                replacement: fileURLToPath(new URL(target.source, pathToFileURL(`${directory}/`))).replace('*', '$1')
            }))
        )
        .sort(
            (left, right) =>
                Number(left.find.source.includes('(.*)')) - Number(right.find.source.includes('(.*)')) || right.find.source.length - left.find.source.length
        );
}
