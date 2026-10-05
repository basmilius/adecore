# Connections

A `Connection` is `{ id, name, config }`. The `config` says where the database is and how to reach it. A SQLite config names a file. A MySQL or MariaDB config reaches its server in one of four ways: over TCP, through a Unix socket, through an SSH host, or through a Docker container. [`ConnectionForm`](/database/views/connection-manager#connectionform) edits all of them, and the host and the helper run them.

```ts
import type { ConnectionConfig } from '@adecore/database/protocol';
```

## TCP

The default. The helper connects to `host` and `port` (3306 when left out), the way any MySQL client does.

```ts
const config: ConnectionConfig = { engine: 'mysql', host: 'db.example.com', user: 'shop', password, database: 'shop', tls: 'require' };
```

`tls` is `disable`, `prefer`, `require` or `verify`. `prefer` is the default and falls back to plain text when the server offers no encryption. `verify` also checks the certificate against `host`, using the roots that ship with the helper. A server with a private certificate authority can use `require`, which encrypts but does not check who answered.

## Unix socket

`socket` replaces `host` and `port` with the path of a socket the server listens on, for a server on the same machine. `host` stays in the config because the protocol asks for one, and is not used.

```ts
const config: ConnectionConfig = { engine: 'mysql', host: '127.0.0.1', socket: '/tmp/mysql.sock', user: 'root' };
```

## SSH

A `tunnel` of kind `ssh` reaches a server that only a bastion host can see. `host`, `port` and `tunnel.host` mean different things here: `tunnel.host` is the machine the helper logs into, and `host` and `port` are the database server as that machine sees it.

```ts
const config: ConnectionConfig = {
    engine: 'mysql',
    host: '10.0.3.12',
    user: 'shop',
    tunnel: { kind: 'ssh', host: 'bastion.example.com', user: 'deploy', identityFile: '/Users/me/.ssh/id_ed25519' }
};
```

The helper runs the `ssh` of the machine, once for every connection it opens, with `-W <host>:<port>`. That has consequences worth knowing before a person reports a failure:

- `~/.ssh/config`, `ProxyJump` and the SSH agent apply. `tunnel.host` can be a `Host` from that file.
- It never asks for a password or a passphrase. It runs with `BatchMode=yes`, so a key without a passphrase, a key in the agent, or an `IdentityFile` in the SSH config has to log in on its own. `identityFile` adds `-i` for one key.
- The host key must be in `known_hosts` already. `BatchMode` refuses to ask whether to trust an unknown host, so the first connection to a new machine fails until someone has connected to it once in a terminal.
- When `ssh` exits before the server has sent anything, the request fails with `tunnel-failed`, and the message is what `ssh` wrote to stderr.
- With `tls: 'verify'`, the certificate is checked against `host`, the name the far end has.

## Docker

A `tunnel` of kind `docker` reaches a server in a container. The helper asks Docker where the container is, so `host`, `port` and `socket` of the config are ignored. `tunnel.container` is a name or an id, `tunnel.port` is the port inside the container (3306 when left out) and `tunnel.context` picks a Docker context other than the current one.

```ts
const config: ConnectionConfig = {
    engine: 'mysql',
    host: '127.0.0.1',
    user: 'root',
    password: 'secret',
    tunnel: { kind: 'docker', container: 'shop-db-1' }
};
```

The helper takes one of two routes:

- A container that publishes its port is reached directly on `127.0.0.1` at the published port. That is the fast route.
- A container that publishes nothing is reached through `docker exec`, which starts `bash` and `cat` inside the container and pipes the connection through them. The image needs both. A connection opens a little slower this way, and so does a cancel, which opens a second connection.

A Docker context that points at another machine (`tcp://` or `ssh://`) never uses published ports, since they are not local, so it always takes the `docker exec` route. A container that does not exist or is not running fails with `tunnel-failed` and Docker's own message. With `tls: 'verify'` the certificate chain is checked but not the host name, since the container has none worth checking.

`docker` and `ssh` are looked up in `PATH` first, then in the places a desktop app started from the Dock often misses: `/usr/local/bin`, `/opt/homebrew/bin`, `/Applications/Docker.app/Contents/Resources/bin` and `/usr/bin`.

## Finding containers

A person does not have to type a container name. `client.discover('docker')` asks the helper for the running containers that look like a database server: an image name that holds `mysql`, `mariadb` or `percona`, or a container that exposes 3306. Each [`DockerContainer`](/database/guide/protocol#discovering-containers) has its name, its image, its ports with the host port each is published on, the Compose project and service, and `suggested` credentials.

`suggested` comes from the environment of the container. The helper reads `MYSQL_USER`, `MYSQL_PASSWORD` and `MYSQL_DATABASE`, then the `MARIADB_` variants. A container with none of them falls back to `root` and `MYSQL_ROOT_PASSWORD` or `MARIADB_ROOT_PASSWORD`. The password therefore reaches the page, which is why the host refuses discovery until the app turns it on with [`authorizeDiscovery`](/database/guide/security#discovery).

Two places use it:

- The Docker mode of the form lists the containers in a select, with the image and the published port beside each name. Picking one fills the container, the port and, where those fields are empty, the user, the password and the database. A refresh button looks again.
- The New connection menu of [`ConnectionManager`](/database/views/connection-manager) has From a Docker container. It lists the same containers and adds a connection named after the Compose `project/service`, or the container's name, with the suggested credentials filled in. Docker is asked only when the submenu opens.

Without `authorizeDiscovery` on the host, `discover` answers `forbidden` and both places say so. Without Docker, or with a daemon that is not running, `discover` answers `unsupported` with what Docker said, and both places show that message instead of a list.

<Demo src="database/connection-form" />

The demo starts in Docker mode. Its in-memory host lists two containers, one that publishes its port and one that does not.

## Which one to offer

Offer what the people of the app need. The form shows all four modes for MySQL and MariaDB. An app that wants fewer can restrict them in the backend with `authorize`, which sees the whole config including the tunnel; see [Security](/database/guide/security#restricting-connections).
