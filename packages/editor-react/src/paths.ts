/* A path inside `folder` relative to it; any other path as it is. */
export function relativeTo(path: string, folder: string): string {
    return path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : path;
}

export function basenameOf(path: string): string {
    return path.replaceAll('\\', '/').split('/').at(-1) ?? path;
}
