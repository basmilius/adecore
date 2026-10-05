export function basenameOf(path: string): string {
    return path.replaceAll('\\', '/').split('/').at(-1) ?? path;
}
