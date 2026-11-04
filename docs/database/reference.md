# Reference

Every name each entry point exports, read from its source. Anything not listed is internal and may change in any release. The [client](/database/api/client), [host](/database/api/host) and [testing](/database/api/testing) pages explain the API in prose, and [How it fits together](/database/guide/architecture) shows which entry point runs where.

| Entry point | Runs in | Imports React or Node |
| --- | --- | --- |
| `@adecore/database` | The page | React |
| `@adecore/database/host` | The app's backend, Bun or Node | Node |
| `@adecore/database/protocol` | Anywhere | Neither |
| `@adecore/database/testing` | Anywhere | Neither |

## Exports

### `@adecore/database`

The views, `DatabaseProvider` and the client they read through.

<ExportTable entry="@adecore/database" />

### `@adecore/database/host`

The host for the app's backend, and the functions that find and start the helper.

<ExportTable entry="@adecore/database/host" />

### `@adecore/database/protocol`

The messages between the page, the host and the helper: types, `PROTOCOL_VERSION` and `valueOfCell`. See [Protocol](/database/guide/protocol).

<ExportTable entry="@adecore/database/protocol" />

### `@adecore/database/testing`

An in-memory transport that answers the protocol, for demos and tests.

<ExportTable entry="@adecore/database/testing" />
