# Lifecycle

Managers retain their options and expose methods; creating one registers no listeners and runs no commands. There is no background subscription or `dispose()` method. The process and installed definition outlive the manager object.

## Installation and removal

| Operation       | Result                                                                          |
| --------------- | ------------------------------------------------------------------------------- |
| `isInstalled()` | Whether `files.read(path)` returns text. It does not inspect a running process. |
| `read()`        | Definition text or `null`.                                                      |
| `install(text)` | Writes different text. Returns `true` only for a changed existing definition.   |
| `start()`       | Starts the installed job using the platform's service commands.                 |
| `restart()`     | Returns a promise; replaces the running job's definition. Await it.             |
| `stop()`        | Attempts to stop the job; keeps its definition.                                 |
| `uninstall()`   | Removes login startup; does not stop an already running process.                |

For a complete removal, call `stop()` and `uninstall()` after host authorization. A best-effort stop can fail, so removal does not prove that the process exited. The host must verify shutdown if it needs that guarantee.

## launchd

The definition path is `<home>/Library/LaunchAgents/<label>.plist`. Commands use `/bin/launchctl` in the `gui/<uid>` domain, with target `gui/<uid>/<label>`. This targets a logged-in GUI user, not a system daemon or arbitrary login session.

Install creates the log directory and writes changed content; it does not load the job. Start runs `print` to check whether the label is loaded, then `kickstart` for a loaded job or `bootstrap` for an unloaded one. A failed `print` is treated as unloaded.

Restart checks whether the label is loaded, sends `bootout`, and checks for its release. It waits up to 25 times for 200ms through the injected `sleep`, then attempts `bootstrap` even if the label remains loaded. The wait is at most five seconds of requested sleeps; command time adds to that. A nonzero bootstrap or kickstart throws. Bootout is best effort.

Uninstall only removes the plist. Stop checks the label and sends bootout when loaded. Neither operation rolls back earlier actions.

## systemd

The definition path is `<configHome>/systemd/user/<unitName>`. The caller supplies `configHome`; the package does not read XDG variables. Lifecycle commands use `systemctl --user`.

Install writes changed content and runs `daemon-reload`, then runs `enable` even if the content was unchanged. It enables login startup without starting the service. A first installation returns `false`. Start calls `start`; restart reloads and calls `restart`.

Stop ignores a nonzero result from `stop`. Uninstall sends `disable`, removes the file, and reloads. It ignores command failures on this removal path. File adapter exceptions still propagate. A reload or enable failure during install can leave a file written on disk; no transaction restores the old text.

## Lingering

Linux user services normally depend on the user's session. `manager.linger?.enabled()` checks whether `loginctl show-user <user> --property=Linger --value` prints `yes`. Other output, including an error with no `yes`, yields `false`.

`manager.linger?.enable()` calls `loginctl enable-linger <user>` and throws on failure. The host must explain and authorize this persistent user-account change before calling it. Installation and startup never enable lingering automatically. There is no disable-linger API; do not disable it during uninstall because other user services may depend on it.

## Serializing operations

Managers provide no operation queue, lock or cancellation token. Keep install/start/restart/remove operations serialized in the host. If a restart's injected sleep rejects, the promise rejects and bootstrap is skipped. Do not start another mutation while the first restart is pending.
