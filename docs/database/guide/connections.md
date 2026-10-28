# Connections

A `Connection` is `{ id, name, config }`. A SQLite config names a file. A MySQL or MariaDB config reaches its server over TCP, a Unix socket, an SSH host or a Docker container. [`ConnectionForm`](/database/views/connection-manager#connectionform) edits all of them, and [Protocol](/database/guide/protocol#connections) lists the fields.

```ts
import type { ConnectionConfig } from '@adecore/database/protocol';
```

## SQLite

`path` is absolute, on the helper's machine. The helper creates a missing file only with `create: true`.

```ts
const config: ConnectionConfig = { engine: 'sqlite', path: '/Users/me/shop.sqlite' };
```

## TCP

The default for MySQL and MariaDB: `host` and `port` (default 3306).

```ts
const config: ConnectionConfig = { engine: 'mysql', host: 'db.example.com', user: 'shop', password, database: 'shop', tls: 'require' };
```

`tls` is `disable`, `prefer` (the default), `require` or `verify`. `prefer` falls back to plain text when TLS fails. `require` encrypts without checking the certificate, for a private certificate authority. `verify` also checks the certificate against `host`, with the roots that ship with the helper.

## Unix socket

`socket` replaces `host` and `port`. The protocol still requires `host`, which goes unused. A socket connection never uses TLS.

```ts
const config: ConnectionConfig = { engine: 'mysql', host: '127.0.0.1', socket: '/tmp/mysql.sock', user: 'root' };
```

## SSH

A `tunnel` of kind `ssh` reaches a server that only another machine can see. The helper logs into `tunnel.host`, and `host` and `port` name the database server as that machine sees it.

```ts
const config: ConnectionConfig = {
    engine: 'mysql',
    host: '10.0.3.12',
    user: 'shop',
    tunnel: { kind: 'ssh', host: 'bastion.example.com', user: 'deploy', identityFile: '/Users/me/.ssh/id_ed25519' }
};
```

The helper runs the system's `ssh -W <host>:<port>` with `BatchMode=yes`:

- `~/.ssh/config`, `ProxyJump` and the SSH agent apply, and `tunnel.host` can be a `Host` of that file. `identityFile` adds `-i` for one key.
- `ssh` never asks for a password or passphrase. A key without a passphrase, the agent or an `IdentityFile` of the config must log in.
- `ssh` never asks to trust an unknown host. The first connection to a new machine fails until its key is in `known_hosts`, for example after one terminal login.
- When `ssh` exits early, the request fails with `tunnel-failed` and the message holds its stderr.
- With `tls: 'verify'`, the certificate is checked against `host`, the server's name on the far side.

## Docker

A `tunnel` of kind `docker` reaches a server in a container. `tunnel.container` is a name or id, `tunnel.port` the port inside the container (default 3306), and `tunnel.context` another Docker context. The helper asks Docker where the container is, so `host`, `port` and `socket` are ignored, and `host` may be empty.

```ts
const config: ConnectionConfig = {
    engine: 'mysql',
    host: '',
    user: 'root',
    password: 'secret',
    tunnel: { kind: 'docker', container: 'shop-db-1' }
};
```

The helper uses a published port when there is one. Otherwise it pipes the connection through `docker exec`, which needs `bash` and `cat` in the image. A context on another machine always uses `docker exec`.

A missing or stopped container fails with `tunnel-failed`. With `tls: 'verify'` the certificate chain is checked, but not the host name.

The helper looks for `docker` and `ssh` in `PATH`, then in folders a macOS app started from the Dock often lacks: `/usr/local/bin`, `/opt/homebrew/bin`, `/Applications/Docker.app/Contents/Resources/bin` and `/usr/bin`.

## Finding containers

`client.discover('docker')` lists running database containers as [`DockerContainer`](/database/guide/protocol#discovering-containers) entries, with `suggested` credentials from their environment. Those include passwords, so the host refuses discovery until the app allows it with [`authorizeDiscovery`](/database/guide/security#discovery).

Two places use it:

- The form's Docker mode lists the containers in a select. Picking one fills the container and port, and the user, password and database where empty.
- The New connection menu of [`ConnectionManager`](/database/views/connection-manager) has From a Docker container, which adds a connection named after its Compose `project/service` or its own name, with the suggested credentials.

Without `authorizeDiscovery`, `discover` fails with `forbidden`. Without Docker or a running daemon, it fails with `unsupported`. Both places show the message instead of a list.

<Demo src="database/connection-form" />

The demo starts in Docker mode, with one container that publishes its port and one that does not.

### Offering containers yourself

To list containers in a place of your own, build connections the way the manager does:

```tsx
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { IconButton, ListRow } from '@adecore/ui';
import { connectionFromContainer, containerTitle, isMysqlContainer, useDatabaseClient, type Connection } from '@adecore/database';
import type { DockerContainer } from '@adecore/database/protocol';

function RunningDatabases({ onAdd }: { onAdd(connection: Connection): void }) {
    const client = useDatabaseClient();
    const [containers, setContainers] = useState<readonly DockerContainer[]>([]);

    useEffect(() => {
        client.discover('docker').then(setContainers, () => setContainers([]));
    }, [client]);

    return containers.filter(isMysqlContainer).map((container) => (
        <ListRow key={container.id}>
            {containerTitle(container)}
            <IconButton icon={Plus} label="Add" onClick={() => onAdd(connectionFromContainer(crypto.randomUUID(), container))} />
        </ListRow>
    ));
}
```

| Function                                 |                                                                                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isMysqlContainer(container)`            | Whether a MySQL or MariaDB connection can point at the container. |
| `containerTitle(container)`              | Its Compose `project/service`, else its own name. |
| `connectionFromContainer(id, container)` | A new `Connection` named by `containerTitle`, in Docker mode on the container's MySQL port (or its first port), with the suggested credentials. |

## Which modes to offer

The form shows all four modes for MySQL and MariaDB. To offer fewer, refuse the others in the backend with `authorize`, which sees the whole config. See [Security](/database/guide/security#restricting-connections).
