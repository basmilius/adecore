# ConnectionManager

The saved connections beside the form of the one picked. Use it in a settings pane or as a view of its own. A person adds a SQLite file or a MySQL or MariaDB server, fills in the form, tests it and deletes it. The manager stores nothing: every add, edit and delete goes out whole through `onValueChange`, and the app saves.

```tsx
import { ConnectionForm, ConnectionManager } from '@adecore/database';
```

<Demo src="database/connection-manager" fill />

```tsx
const [connections, setConnections] = useState<readonly Connection[]>(saved);

<ConnectionManager value={connections} onValueChange={setConnections} className="h-full" />
```

The list is a [`MasterDetail`](/ui/settings/master-detail) from `@adecore/ui`, so it fills the height it is given, scrolls each side on its own and stacks under 640 pixels. Give it a size through `className`.

## Behavior

- New connection opens a menu with the two engines. The new connection gets a generated id, a name and a config with the defaults of its engine (port 3306 and `prefer` for TLS on MySQL, an empty path on SQLite), and becomes the selected one.
- The detail shows the form, a Test connection button and a Delete button. Test opens the connection through the [client](/database/api/client), shows the server and its version (`MariaDB 11.4.2`) or the error, and is disabled while the config has a problem. An answer to an earlier config is never shown for a newer one.
- Delete asks first, closes the connection's session with `client.disconnect` and selects a neighbor. The database itself is not touched.
- Without `selected`, the manager keeps the selection itself and starts at the first connection. Pass `selected` and `onSelectedChange` to control it, for example to open a connection from outside.

## ConnectionForm

`ConnectionForm` is the form on its own, for the app that wants it somewhere else, such as in a dialog. It edits one `Connection` and sends every edit out whole.

<Demo src="database/connection-form" />

The fields follow the engine:

- SQLite has the file, a Browse button when the app gives `onBrowse`, and Create file.
- MySQL and MariaDB have the host, the port, the user, the password, the database to start in, a socket (advanced) and the encryption (`disable`, `prefer`, `require` or `verify`).
- Both have Read only.

Switching the engine keeps the name and id and resets the rest. A field says what is wrong with it (a relative SQLite path, an empty host, a port outside 1 to 65535) once a person has touched it or typed in it, so a new form does not open with errors. A socket stands in for the host.

The password sits in `config.password`. Splitting it off before you save is the app's job; see [Security](/database/guide/security#passwords).

## Browse

A SQLite path is typed unless the app passes `onBrowse`, which opens its own file dialog and resolves with the chosen path, or `null` when the person cancelled.

```tsx
<ConnectionManager
    value={connections}
    onValueChange={save}
    onBrowse={async () => (await window.app.pickFile({ filters: [{ name: 'SQLite', extensions: ['sqlite', 'db'] }] })) ?? null}
/>
```

## ConnectionManager props

| Prop | Type | |
| --- | --- | --- |
| `value` | `readonly Connection[]` | The saved connections. |
| `onValueChange` | `(next: readonly Connection[]) => void` | Every add, edit and delete, as the whole new list. |
| `selected` | `string \| null` | The id of the connection in the detail. `null` is none. |
| `onSelectedChange` | `(id: string \| null) => void` | The person picked another. |
| `onBrowse` | `() => Promise<string \| null>` | Opens the app's file dialog for a SQLite path. |
| `className` | `string` | |
| `ref` | `Ref<HTMLDivElement>` | |

`value` and `onValueChange` are required. Without `selected` the manager keeps the selection itself. `ConnectionManagerProps` is an exported type.

## ConnectionForm props

| Prop | Type | |
| --- | --- | --- |
| `value` | `Connection` | The connection being edited. |
| `onValueChange` | `(next: Connection) => void` | Every edit, whole. |
| `onBrowse` | `() => Promise<string \| null>` | Opens the app's file dialog for a SQLite path. |
| `className` | `string` | |
| `ref` | `Ref<HTMLDivElement>` | |

`value` and `onValueChange` are required. `ConnectionFormProps` is an exported type. Both views need a [`DatabaseProvider`](/database/guide/getting-started#mount-the-page) above them, since Test and Delete go through the client.
