// These inherited hooks must remain blocked while older hosts are still in use.
export const RUIMTE_SESSION_VARIABLES = ['RUIMTE_HOOK_URL', 'RUIMTE_HOOK_TOKEN', 'RUIMTE_CONTEXT_URL', 'RUIMTE_CONTEXT_TOKEN', 'RUIMTE_SESSION_ID'] as const;

export interface CliEnvironmentPolicy {
    variables?: readonly string[];
    prefixes?: readonly string[];
    /* A host prefix such as APP strips its hook/context variables and session id, leaving APP_HOME intact. */
    sessionPrefixes?: readonly string[];
}

const COMPATIBILITY_PREFIXES = ['RUIMTE_HOOK_', 'RUIMTE_CONTEXT_'];

export function cliEnvironment(env: Record<string, string | undefined> = process.env, policy: CliEnvironmentPolicy = {}): Record<string, string> {
    const variables = new Set<string>([...RUIMTE_SESSION_VARIABLES, ...(policy.variables ?? [])]);
    const prefixes = [...COMPATIBILITY_PREFIXES, ...(policy.prefixes ?? [])];
    for (const host of policy.sessionPrefixes ?? []) {
        const prefix = host.replace(/_+$/, '');
        if (prefix === '') {
            throw new Error('A session environment prefix must not be empty');
        }
        variables.add(`${prefix}_SESSION_ID`);
        prefixes.push(`${prefix}_HOOK_`, `${prefix}_CONTEXT_`);
    }
    const clean: Record<string, string> = {};
    for (const [name, value] of Object.entries(env)) {
        if (value !== undefined && !variables.has(name) && !prefixes.some((prefix) => name.startsWith(prefix))) {
            clean[name] = value;
        }
    }
    return clean;
}
