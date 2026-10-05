# ConnectionManager

The saved connections beside the form of the one picked. Use it in a settings pane or as a view of its own. A person adds a SQLite file, a MySQL or MariaDB server or a database in a Docker container, fills in the form, tests it and deletes it. The manager stores nothing: every add, edit and delete goes out whole through `onValueChange`, and the app saves.

```tsx
import { ConnectionForm, ConnectionManager } from '@adecore/database';
```

<Demo src="database/connection-manager" fill />

```tsx
const [connections, setConnections] = useState<readonly Connection[]>(saved);

<ConnectionManager value={connections} onValueChange={setConnections} className="h-full" />;
```

The list is a [`MasterDetail`](/ui/settings/master-detail) from `@adecore/ui`, so it fills the height it is given, scrolls each side on its own and stacks under 640 pixels. Give it a size through `className`.

## Behavior

- New connection opens a menu with the two engines and From a Docker container. The new connection gets a generated id, a name and a config with the defaults of its engine (port 3306 and `prefer` for TLS on MySQL, an empty path on SQLite), and becomes the selected one.
- From a Docker container lists the running containers that look like a database server, asked for when the submenu opens. Picking one adds a MySQL connection named after the container's Compose `project/service`, or its own name, through Docker, with the user, password and database the container's environment suggests. Without Docker the submenu says so and offers Try again. See [Connections](/database/guide/connections#finding-containers).
- Each connection in the list shows a line under its name: the file name of a SQLite file, `user@host:port`, `user@host via <ssh host>` or `user@container (Docker)`.
- The detail shows the form, a Test connection button and a Delete button. Test opens the connection through the [client](/database/api/client), shows the server and its version (`MariaDB 11.4.2`) or the error, and is disabled while the config has a problem. An answer to an earlier config is never shown for a newer one.
- Delete asks first, closes the connection's session with `client.disconnect` and selects a neighbor. The database itself is not touched.
- Without `selected`, the manager keeps the selection itself and starts at the first connection. Pass `selected` and `onSelectedChange` to control it, for example to open a connection from outside.

## ConnectionForm

`ConnectionForm` is the form on its own, for the app that wants it somewhere else, such as in a dialog. It edits one `Connection` and sends every edit out whole.

<Demo src="database/connection-form" />

The demo starts in Docker mode, and its in-memory host lists two containers. Testing a connection through Docker works there because the fake finds a server by its host, `127.0.0.1` by default.

The fields follow the engine:

- SQLite has the file, a Browse button when the app gives `onBrowse`, and Create file.
- MySQL and MariaDB start with Connect through, which has four modes: TCP, Socket, SSH and Docker. The user, the password, the database to start in and the encryption (`disable`, `prefer`, `require` or `verify`) follow, and are the same in every mode.
- Both have Read only.

What Connect through changes:

| Mode   | Fields                                                                                                                                                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TCP    | Host and port.                                                                                                                                                                                                                     |
| Socket | The path of a Unix socket.                                                                                                                                                                                                         |
| SSH    | The SSH host, port and user, an identity file (with a Browse button when the app gives `onBrowse`), and the server's host and port as the SSH host sees them. A key or the SSH agent has to answer, and a password is never asked. |
| Docker | A container, picked from the running ones with a refresh button, and the port inside it. The list shows each image and the host port the container publishes, or says it publishes none.                                           |

The modes are explained in [Connections](/database/guide/connections). Switching the mode keeps the name, the id, the user, the password and the database, and drops the fields of the old mode. Switching the engine keeps the name and id and resets the rest. Picking a container fills the user, the password and the database from its environment, where those fields are empty.

A field says what is wrong with it (a relative SQLite path, an empty host, a port outside 1 to 65535, an empty SSH host, no container) once a person has touched it or typed in it, so a new form does not open with errors.

The password sits in `config.password`. Splitting it off before you save is the app's job; see [Security](/database/guide/security#passwords).

## Browse

A SQLite path and the identity file of an SSH connection are typed unless the app passes `onBrowse`, which opens its own file dialog and resolves with the chosen path, or `null` when the person cancelled. The function gets the purpose of the file, `'database'` for the SQLite path and `'identity'` for the SSH key, so the dialog can filter on the extensions of a database file for one and open in the folder of keys for the other.

```tsx
<ConnectionManager value={connections} onValueChange={save} onBrowse={async (purpose) => (await window.app.pickFile(purpose)) ?? null} />
```

## ConnectionManager props

| Prop               | Type                                                             |                                                                                            |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `value`            | `readonly Connection[]`                                          | The saved connections.                                                                     |
| `onValueChange`    | `(next: readonly Connection[]) => void`                          | Every add, edit and delete, as the whole new list.                                         |
| `selected`         | `string \| null`                                                 | The id of the connection in the detail. `null` is none.                                    |
| `onSelectedChange` | `(id: string \| null) => void`                                   | The person picked another.                                                                 |
| `onBrowse`         | `(purpose: 'database' \| 'identity') => Promise<string \| null>` | Opens the app's file dialog for a SQLite path (`'database'`) or an SSH key (`'identity'`). |
| `className`        | `string`                                                         |                                                                                            |
| `ref`              | `Ref<HTMLDivElement>`                                            |                                                                                            |

`value` and `onValueChange` are required. Without `selected` the manager keeps the selection itself. `ConnectionManagerProps` is an exported type.

## ConnectionForm props

| Prop            | Type                                                             |                                                                                            |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `value`         | `Connection`                                                     | The connection being edited.                                                               |
| `onValueChange` | `(next: Connection) => void`                                     | Every edit, whole.                                                                         |
| `onBrowse`      | `(purpose: 'database' \| 'identity') => Promise<string \| null>` | Opens the app's file dialog for a SQLite path (`'database'`) or an SSH key (`'identity'`). |
| `className`     | `string`                                                         |                                                                                            |
| `ref`           | `Ref<HTMLDivElement>`                                            |                                                                                            |

`value` and `onValueChange` are required. `ConnectionFormProps` is an exported type. Both views need a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above them: Test and Delete go through the client, and so does the list of containers in the Docker mode.
