# User services

`@adecore/service` generates launchd property lists and systemd user units, then controls them through injected commands and files. It supports macOS GUI LaunchAgents and Linux user services. It has no Windows manager.

The package is private at `0.0.0` until first publication is configured. Use the local checkout with its `source` export condition, or build its compiled exports. The transferred package retains [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/service/LICENSE).

## Read the guides

- [Getting started](/service/getting-started) builds a definition and installs it with safe in-memory adapters.
- [Definitions and identity](/service/definitions) covers required values, escaping and executable ownership checks.
- [Lifecycle](/service/lifecycle) explains installation, reloads, restart waits, removal and lingering.
- [API reference](/service/reference) lists the entrypoints, options, return values and adapter contracts.
- [Testing and host migration](/service/testing-migration) covers production adapters, authorization, failures and compatibility.

Definitions are strings. Managers act on those strings without parsing them or deciding who may replace them. The host chooses the executable, identity, environment and storage paths, authorizes each mutation, and retains its executable installation and cache policy.

`@adecore/service/definitions` imports no Node or Bun runtime APIs. The root, `/manager`, `/platform` and `/system` are backend entrypoints. Keep service control out of a browser renderer and route requests through the host's existing sender and permission checks.
