/* An HTTP MCP server a CLI loads from its command line, with a bearer token it reads from its own environment. */
export interface CliMcpServer {
    readonly name: string;
    readonly url: string;

    /* The variable the CLI reads the token from, so the token never sits on a command line a person can read back. */
    readonly tokenVariable: string;
}

/* An `Authorization` header that Claude Code and Copilot fill in from the variable themselves. */
export function cliMcpHeaders(tokenVariable: string): Record<string, string> {
    return { Authorization: `Bearer \${${tokenVariable}}` };
}

/*
 * Claude Code expands `${VAR}` in a config's headers, also under `--strict-mcp-config` (measured on 2.1.316). The `=`
 * form matters, since the flag is variadic and would swallow the argument after it.
 */
export function claudeMcpArgs(server: CliMcpServer): string[] {
    const config = { mcpServers: { [server.name]: { type: 'http', url: server.url, headers: cliMcpHeaders(server.tokenVariable) } } };

    return [`--mcp-config=${JSON.stringify(config)}`];
}

/*
 * Codex reads the token from the variable it names, and `approve` runs every tool without an elicitation, the way
 * Claude Code's allow rule does (measured on Codex 0.164). A JSON string is a valid TOML basic string.
 */
export function codexMcpArgs(server: CliMcpServer, approveTools = true): string[] {
    // The name is a segment of a dotted override path, so a dot or a quote in it would name another key.
    if (!/^[A-Za-z0-9_-]+$/.test(server.name)) {
        throw new Error(`An MCP server name for Codex must be a bare TOML key (letters, digits, "_" and "-"): ${JSON.stringify(server.name)}`);
    }

    const key = `mcp_servers.${server.name}`;

    return [
        '-c',
        `${key}.url=${JSON.stringify(server.url)}`,
        '-c',
        `${key}.bearer_token_env_var=${JSON.stringify(server.tokenVariable)}`,
        ...(approveTools ? ['-c', `${key}.default_tools_approval_mode="approve"`] : [])
    ];
}

// Copilot expands `${VAR}` in headers but refuses it in a URL, so the URL is literal (measured on Copilot CLI 1.0.104).
export function copilotMcpArgs(server: CliMcpServer): string[] {
    const config = {
        mcpServers: { [server.name]: { type: 'http', url: server.url, headers: cliMcpHeaders(server.tokenVariable), tools: ['*'] } }
    };

    return [`--additional-mcp-config=${JSON.stringify(config)}`];
}

/* The argument that runs every tool of the server without a prompt in Claude Code, in every mode. */
export function claudeMcpAllowArgs(serverName: string): string[] {
    return [`--allowedTools=mcp__${serverName}`];
}

/* The same for Copilot, whose permission requests name no server, so the flag is the only way to allow one. */
export function copilotMcpAllowArgs(serverName: string): string[] {
    return [`--allow-tool=${serverName}`];
}
