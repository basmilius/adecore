# Scripts

`build.ts` builds `dist`. `tee-cli.ts` records an agent CLI for test fixtures.

## Recording a CLI with `tee-cli.ts`

```sh
bun packages/agents/scripts/tee-cli.ts <out.ndjson> [--stderr] [--env NAME]... -- <command> [args]
```

The recorder starts the command and passes its stdin and stdout through byte for byte, so the real backend drives the real CLI. It writes one JSON object per line to `<out.ndjson>`:

```json
{"type":"start","t":0,"command":["codex","app-server"]}
{"type":"line","t":12,"dir":"in","line":"{\"id\":1,\"method\":\"initialize\",...}"}
{"type":"line","t":340,"dir":"out","line":"{\"id\":1,\"result\":{...}}"}
{"type":"exit","t":9120,"code":0,"signal":null}
```

`t` counts milliseconds from the start. `dir` is `in` for what went to the CLI, `out` for what it printed and `err` for stderr. `line` holds the raw text, so a line that is not JSON survives too.

The recording leaves out stderr and the environment. `--stderr` adds the stderr lines, and `--env NAME` adds the value of one variable. The CLI always gets the full environment, and its stderr always reaches the caller.

The recorder refuses an output file inside a git work tree, so raw sessions stay out of every repository. It also refuses a file that already exists, and it creates the new one with mode 0600. It writes each record as it comes, so a killed recorder keeps everything before the kill. The CLI runs in the recorder's process group, so a signal to the group reaches both, and the recorder exits with the CLI's code.

## Putting it in front of a backend

Every backend puts its own arguments after the launch command, so the recorder goes in front of that command. The cleanest way is a launch decorator on the provider:

```ts
const tee = (out: string): LaunchDecorator => (launch) => ({
    ...launch,
    command: ['bun', '/path/to/tee-cli.ts', out, '--', ...launch.command]
});
```

- Claude. `createClaudeProvider({ launch: tee(out) })`, or `command: ['bun', TEE, out, '--', 'claude']`. The backend hands `command[0]` to the Agent SDK as the executable and adds the SDK's flags after the whole command, so the recorder sees `-- claude <flags>`. Detection and version checks use the provider's own `command`, not the decorated one.
- Codex. `createCodexProvider({ command: ['bun', TEE, out, '--', 'codex', 'app-server'] })`, or `launch: tee(out)`. The backend adds its MCP arguments after the command.
- ACP (Grok, Copilot, Antigravity). `launch` on the ACP spec wraps `[spec.command, ...spec.args]`, or for Antigravity the command of its installed server. The backend adds its allow arguments after it.

A host that already sets `launch` (to add its MCP servers, say) composes the two: `launch: (launch) => tee(out)(ownLaunch(launch))`. Replacing it drops what it added, and the recording then shows a different session.

A shim on the `PATH` named like the CLI that runs `exec bun tee-cli.ts ... -- /real/cli "$@"` also works for a CLI started by name. It does not reach a server started by absolute path.

Before a recording becomes a fixture, cut it down by hand. Replace session ids, account ids, emails, home paths and tokens with stable placeholders, keep only the frames the test needs, and name the CLI version and how it was recorded in `source`.
