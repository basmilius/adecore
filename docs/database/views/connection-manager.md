# ConnectionManager

The saved connections beside the picked one's form. A person adds a SQLite file, a MySQL or MariaDB server or a Docker container, tests it and deletes it. The manager stores nothing: every change goes out as the whole new list, and the app saves it.

```tsx
import { ConnectionForm, ConnectionManager } from '@adecore/database';
```

<Demo src="database/connection-manager" fill />

```tsx
const [connections, setConnections] = useState<readonly Connection[]>(saved);

<ConnectionManager value={connections} onValueChange={setConnections} className="h-full" />;
```

It fills its height, with the list and the detail scrolling separately. Under 640 pixels wide the two stack. It draws no border, so a dialog puts its header above and its footer below:

```tsx
<Dialog.Popup className="flex h-[640px] w-[800px] flex-col">
    <div className="flex items-center gap-4 border-b border-border px-5 py-4">
        <Dialog.Title className="grow">Connections</Dialog.Title>
        <CloseButton label="Close" dialog />
    </div>
    <ConnectionManager value={connections} onValueChange={save} className="min-h-0 flex-1" />
    <div className="flex justify-end border-t border-border px-5 py-3">
        <Dialog.Close render={<Button variant="secondary" />}>Done</Dialog.Close>
    </div>
</Dialog.Popup>
```

- New connection offers both engines and From a Docker container. A new connection gets a generated id and engine defaults: port 3306 and `prefer` TLS on MySQL, an empty path on SQLite.
- From a Docker container lists running database containers and adds the picked one. See [Finding containers](/database/guide/connections#finding-containers).
- Under each name is the SQLite file name, or `user@host:port`, `user@host via <ssh host>` or `user@container (Docker)`.
- Test connection shows the server and version, such as `MariaDB 11.4.2`, or the error, pinned at the top of the detail until dismissed or the config changes. It is disabled while the form has a problem.
- Delete asks first, closes the connection's sessions and selects a neighbor. The database is untouched.
- Without `selected`, the manager keeps the selection, starting at the first connection. Pass `selected` and `onSelectedChange` to control it.

## Settings of your own

`renderFields` draws the app's own settings for the picked connection, such as team sharing, after the form's last field. Use a horizontal `Field`, like the form's Read only:

```tsx
<ConnectionManager
    value={connections}
    onValueChange={save}
    renderFields={(connection) => (
        <Field label="Shared" hint="Everyone on the team sees this connection." orientation="horizontal" group>
            <Switch label="Shared" checked={shared.has(connection.id)} onCheckedChange={(next) => setShared(connection.id, next)} />
        </Field>
    )}
/>
```

## Drafts

The manager hands over every edit at once, so its list can hold an unfinished connection, such as a SQLite connection without a path. `isValidConfig(config)` tells whether a config can be saved. Keep showing the draft, and save the last complete version:

```tsx
import { isValidConfig, type Connection } from '@adecore/database';

function onValueChange(next: readonly Connection[]): void {
    setConnections(next);
    save(next.flatMap((connection) => (isValidConfig(connection.config) ? [connection] : saved.filter((old) => old.id === connection.id))));
}
```

The form reports problems as a `ConfigProblems` object with a `ConfigProblem` code per field, empty when valid.

| Field           | Codes                            |
| --------------- | -------------------------------- |
| `path`          | `path-required`, `path-relative` |
| `host`          | `host-required`                  |
| `port`          | `port-range`                     |
| `socket`        | `socket-required`                |
| `sshHost`       | `ssh-host-required`              |
| `sshPort`       | `ssh-port-range`                 |
| `container`     | `container-required`             |
| `containerPort` | `container-port-range`           |

## ConnectionForm

The form on its own, such as for a dialog. It edits one `Connection` and sends the whole connection on every edit.

<Demo src="database/connection-form" />

A SQLite connection has the file, with Browse when the app passes `onBrowse`, and Create file. A MySQL or MariaDB connection has Connect through with four modes, then the user, password, starting database and encryption. Both have Read only.

| Mode   | Fields                                                                                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| TCP    | The host and the port.                                                                                                                        |
| Socket | The path of a Unix socket.                                                                                                                    |
| SSH    | The SSH host, port and user, an identity file, and the server's host and port as the SSH host sees them.                                      |
| Docker | A running container, with a refresh button, and the port inside it. |

[Connections](/database/guide/connections) explains each mode. Switching the mode keeps the name, account and database, and drops the old socket or tunnel. Switching the engine keeps only the id and name.

A field shows its problem once touched or filled, so a new form opens without errors.

The password is in `config.password`. The app splits it off before saving; see [Security](/database/guide/security#passwords).

## Browse

Without `onBrowse` a person types the SQLite path and identity file. `onBrowse(purpose)` opens the app's file dialog and resolves with the chosen path, or `null` on cancel. `purpose` is `'database'` for a SQLite path or `'identity'` for an SSH key.

```tsx
<ConnectionManager value={connections} onValueChange={save} onBrowse={(purpose) => window.app.pickFile(purpose)} />
```

## Props

Both need a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above them.

### ConnectionManager

| Prop               | Type                                                             | Default |                                                                                                     |
| ------------------ | ---------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `value`            | `readonly Connection[]`                                          |         | Required. The saved connections.                                                                    |
| `onValueChange`    | `(next: readonly Connection[]) => void`                          |         | Required. Every add, edit and delete, as the whole new list.                                        |
| `selected`         | `string \| null`                                                 |         | The id of the connection in the detail. `null` is none.                                             |
| `onSelectedChange` | `(id: string \| null) => void`                                   |         | The person picked another connection.                                                               |
| `onBrowse`         | `(purpose: 'database' \| 'identity') => Promise<string \| null>` |         | Opens the app's file dialog.                                                                        |
| `renderFields`     | `(connection: Connection) => ReactNode`                          |         | The app's own settings of the picked connection. See [Settings of your own](#settings-of-your-own). |
| `className`        | `string`                                                         |         | Its size.                                                                                           |
| `ref`              | `Ref<HTMLDivElement>`                                            |         |                                                                                                     |

`ConnectionManagerProps` is an exported type.

### ConnectionForm

| Prop            | Type                                                             | Default |                                                |
| --------------- | ---------------------------------------------------------------- | ------- | ---------------------------------------------- |
| `value`         | `Connection`                                                     |         | Required. The connection being edited.         |
| `onValueChange` | `(next: Connection) => void`                                     |         | Required. Every edit, as the whole connection. |
| `onBrowse`      | `(purpose: 'database' \| 'identity') => Promise<string \| null>` |         | Opens the app's file dialog.                   |
| `className`     | `string`                                                         |         |                                                |
| `ref`           | `Ref<HTMLDivElement>`                                            |         |                                                |

`ConnectionFormProps` is an exported type.
