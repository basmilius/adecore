import { describe, expect, test } from 'bun:test';
import { claudeMcpAllowArgs, claudeMcpArgs, cliMcpHeaders, codexMcpArgs, copilotMcpAllowArgs, copilotMcpArgs, type CliMcpServer } from './cli-mcp.ts';

const SERVER: CliMcpServer = { name: 'own', url: 'http://127.0.0.1:4000/mcp', tokenVariable: 'OWN_TOKEN' };

function jsonAfter(flag: string, args: readonly string[]): unknown {
    expect(args).toHaveLength(1);
    expect(args[0]).toStartWith(`${flag}=`);

    return JSON.parse(args[0]!.slice(flag.length + 1));
}

describe('an MCP server on a CLI command line', () => {
    test('Claude Code gets one `=` config whose header it fills in from the variable', () => {
        expect(jsonAfter('--mcp-config', claudeMcpArgs(SERVER))).toEqual({
            mcpServers: { own: { type: 'http', url: SERVER.url, headers: { Authorization: 'Bearer ${OWN_TOKEN}' } } }
        });
    });

    test('Codex names the variable and approves every tool through its config overrides', () => {
        expect(codexMcpArgs(SERVER)).toEqual([
            '-c',
            'mcp_servers.own.url="http://127.0.0.1:4000/mcp"',
            '-c',
            'mcp_servers.own.bearer_token_env_var="OWN_TOKEN"',
            '-c',
            'mcp_servers.own.default_tools_approval_mode="approve"'
        ]);
    });

    test('Codex leaves the approval alone for a server whose tools are not all allowed', () => {
        expect(codexMcpArgs(SERVER, false)).toEqual([
            '-c',
            'mcp_servers.own.url="http://127.0.0.1:4000/mcp"',
            '-c',
            'mcp_servers.own.bearer_token_env_var="OWN_TOKEN"'
        ]);
    });

    test('Codex 0.166.0 and newer offer the tools of a server marked direct outside Code Mode and tool search, and only those', () => {
        const omits = (server: CliMcpServer, version: string | null) => codexMcpArgs(server, true, version).some((arg) => arg.includes('omit_tools_from'));

        for (const version of ['0.166.0', '0.166.1', '0.167.0-alpha.2', '1.0.0']) {
            expect(codexMcpArgs({ ...SERVER, directTools: true }, true, version)).toContain('mcp_servers.own.omit_tools_from=["code_mode","deferred"]');
        }

        for (const version of ['0.165.9', '0.166.0-alpha.1', 'unknown', null]) {
            expect(omits({ ...SERVER, directTools: true }, version)).toBe(false);
        }

        expect(omits(SERVER, '0.166.0')).toBe(false);
    });

    test('Codex refuses a name that is not a bare key of its config path', () => {
        expect(() => codexMcpArgs({ ...SERVER, name: 'my.server' })).toThrow('bare TOML key');
        expect(() => codexMcpArgs({ ...SERVER, name: 'own"' })).toThrow('bare TOML key');
        expect(() => codexMcpArgs({ ...SERVER, name: 'my-server_2' })).not.toThrow();
    });

    test('Copilot gets a literal URL, the header from the variable, and every tool', () => {
        expect(jsonAfter('--additional-mcp-config', copilotMcpArgs(SERVER))).toEqual({
            mcpServers: { own: { type: 'http', url: SERVER.url, headers: { Authorization: 'Bearer ${OWN_TOKEN}' }, tools: ['*'] } }
        });
    });

    test('the header names the variable and holds no value', () => {
        expect(cliMcpHeaders('OWN_TOKEN')).toEqual({ Authorization: 'Bearer ${OWN_TOKEN}' });
    });
});

describe('allowing the tools of an MCP server', () => {
    test('is a flag for Claude Code and Copilot', () => {
        expect(claudeMcpAllowArgs('own')).toEqual(['--allowedTools=mcp__own']);
        expect(copilotMcpAllowArgs('own')).toEqual(['--allow-tool=own']);
    });
});
