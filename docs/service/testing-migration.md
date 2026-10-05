# Testing and host migration

Test service policy with injected adapters. No service-manager test needs to run launchctl, systemctl or loginctl, copy a real executable, or wait five seconds.

The [getting started example](/service/getting-started#a-safe-first-installation) supplies in-memory files, a recorded command runner and an immediately resolved sleep. Extend that runner with responses per command to test a loaded label, failed enable command or lingering status. Assert the command arguments and definition text, not just the absence of an exception.

## Cases worth keeping

- First install returns `false`; a changed existing definition returns `true`; unchanged text avoids rewriting.
- A conflicting executable is refused by the host before install.
- launchd restart waits for the label to disappear before bootstrap. A label that remains loaded eventually attempts bootstrap and can fail.
- systemd install reloads changed text and always enables the unit. It can leave written text behind when a later command fails.
- Stop and uninstall remain best effort. File failures and start/restart failures propagate.
- Linger checks and enabling run only when the host asks for them.
- Unsupported platform manager selection returns `null`; unsupported definition generation throws.

The package's [manager tests](https://github.com/basmilius/adecore/blob/main/packages/service/src/manager.test.ts) show these fake seams. [Definition tests](https://github.com/basmilius/adecore/blob/main/packages/service/src/definitions.test.ts) check XML and systemd escaping and retain snapshots of the full definitions.

## Migrating a host adapter

Keep the existing launchd label, systemd unit name, log destination, executable path and environment variable names. A package import rename does not authorize changing installed service identity or persisted configuration.

Replace definition rendering with `launchAgentPlist`, `systemdUnit` or `serviceDefinition`. Construct the manager with the same uid/home/config-home/user data and adapters the backend already uses. Move the install flow behind the host's existing permission check, then read and check the old definition before replacement.

Executable copying, stable install locations, package-runner cache policy, shell environment filtering, user prompts and sender validation remain host responsibilities. The package neither downloads a worker nor decides whether a command is safe. Preserve any existing cache namespace and executable ownership rules when replacing local helpers.

Use real `diskFiles` and `runCommand` only after those checks. A native desktop bridge should expose authorized operations, not raw command execution or arbitrary definition writes. If your host needs cancellation, audit logging, atomic writes or process health checks, implement those around the adapters; the manager supplies none of them.

## Troubleshooting

| Symptom                                      | Check                                                                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| LaunchAgent exists but does not start        | GUI uid/domain, absolute executable, explicit PATH, working directory and writable log directory. A plist on disk is not a loaded job. |
| Restart fails with an I/O error              | Old label may still be loaded after the bounded wait. Preserve the thrown bootstrap output.                                            |
| Linux file exists but service is not enabled | Install may have written the file before reload/enable failed. Retry only after understanding the command error.                       |
| Linux service exits at logout                | Check linger separately and obtain authorization before enabling it.                                                                   |
| `isInstalled()` reports false unexpectedly   | `diskFiles.read` also returns `null` for permission errors. Use a stricter read adapter for diagnosis.                                 |
| Removal succeeded but process remains        | Uninstall does not stop. Verify the result of the host's stop/shutdown policy.                                                         |
| A synchronous host operation stalls          | `runCommand` can block for up to 15 seconds per command. Inject a bounded runner appropriate to the backend.                           |

The transferred code retains FSL-1.1-MIT. Keep its license with distributed package contents; this migration does not change its terms.
