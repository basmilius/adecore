/* The prop a written one stands for: its alias in the catalog, unless the written one is a prop itself or the real prop is written too. */
export function aliasedProp(entry: object, written: string, props: Readonly<Record<string, unknown>>): string {
    const aliases = 'aliases' in entry ? (entry.aliases as Readonly<Record<string, string>>) : {};
    const shape = 'schema' in entry ? (entry.schema as { shape?: object }).shape : undefined;
    const target = Object.hasOwn(aliases, written) ? aliases[written] : undefined;

    return target === undefined || Object.hasOwn(props, target) || (shape !== undefined && Object.hasOwn(shape, written)) ? written : target;
}
