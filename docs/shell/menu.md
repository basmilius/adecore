# Application menu

The page knows what has focus, so it builds the menu. It sends a `MenuSpec`, a tree of `MenuNode`s, over IPC whenever focus changes. The shell draws it natively and sends a picked command back by id. Every label comes from the page, so the menu speaks the interface's language.

## The shape

```ts
import type { MenuNode, MenuSpec } from '@adecore/shell/bridge';

type ShellAction = 'devtools';

const spec: MenuSpec<ShellAction> = {
    menus: [
        {
            id: 'file',
            label: 'File',
            items: [
                { kind: 'command', id: 'project.new', label: 'New project', accelerator: 'CommandOrControl+N' },
                { kind: 'separator' },
                { kind: 'role', role: 'quit', label: 'Quit' }
            ]
        }
    ]
};
```

| Kind | What the shell draws |
|---|---|
| `command` | An item that sends its `id` back. `checked` makes it a check box, `radio` one of a group, and `enabled: false` greys it out. `keys` is the shortcut as the page prints it, for a menu the page draws itself; the shell ignores it. |
| `role` | A native role from `MENU_ROLES`, with the page's label. |
| `shell` | Something only the shell can carry out. The type parameter lists an app's own actions. |
| `separator` | A line. |
| `submenu` | A nested menu, which `enabled: false` greys out. |

A menu in the bar may take a `MenuBarRole`. On macOS the system lists open windows in the `role: 'window'` menu and puts its search field in the `role: 'help'` menu. The shell drops a role it does not know.

```ts
{ id: 'window', label: 'Window', role: 'window', items: [{ kind: 'role', role: 'minimize', label: 'Minimize' }] }
```

## Drawing it

`menuTemplateOf` turns a spec into a template for `Menu.buildFromTemplate`, or returns `null` for anything that is not a spec. `shellItem` draws the app's own actions. Return `null` to leave one out.

```ts
import { createMenuCommands, createPageKeys, devToolsAccelerator, menuTemplateOf } from '@adecore/shell';

const pageKeys = createPageKeys();
const runCommand = createMenuCommands({ pageKeys, window: () => BrowserWindow.getFocusedWindow() });

window.webContents.on('before-input-event', (_event, input) => pageKeys.saw(input));

// The app's own handler, behind its check of the sender.
onFromApp('menu:set', (_event, spec: MenuSpec<ShellAction>) => {
    const template = menuTemplateOf(spec, {
        run: runCommand,
        shellItem: (action, label) =>
            action === 'devtools' ? { label, accelerator: devToolsAccelerator(), click: () => window.webContents.toggleDevTools() } : null
    });
    if (template) {
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }
});
```

Off macOS an accelerator is shown but never registered, so keys such as Ctrl+W reach the page.

## A key the page already had

On macOS the menu fires its accelerator even when the page handled the key. `createMenuCommands` drops an accelerator-fired command when `createPageKeys` saw a Cmd or Ctrl key in the page within the last second. A mouse pick always runs.

`keyBypassesPage` covers an embedded page that never passes keys on, such as a `<webview>`. While it has the keyboard, the menu answers every key. A command reaches the page as `menu:run` with its id. Only a minimized window is shown first.

## The menu before the page's

`staticMenuTemplate` is the menu that stands until the page sends its own: at start, after a reload or crash, and while no window is open, so Quit is always there. Its View menu has no reload or zoom roles, since their accelerators would take keys from the page.

```ts
import { staticMenuTemplate } from '@adecore/shell';

Menu.setApplicationMenu(
    Menu.buildFromTemplate(
        staticMenuTemplate({
            appName: app.name,
            toggleDevTools: () => window.webContents.toggleDevTools(),
            appItems: [{ label: `About ${app.name}…`, click: openAbout }],
            fileItems: [{ label: 'New Window', accelerator: 'CommandOrControl+Shift+N', click: openWindow }],
            quitItems: []
        })
    )
);
```

`appItems` go at the top of the app menu on macOS. `quitItems` go right above Quit, which sits in the File menu off macOS. `fileItems` get their own File menu on macOS and lead the File menu elsewhere. On macOS this menu is the only way to open a window after the last one closes. An item whose accelerator the page also answers can call `pageKeys.take()` to drop a key the page already had, as `createMenuCommands` does.

`MenuTemplateOptions`, `MenuCommandOptions`, `MenuWindow` (the part of a window a command reaches), `StaticMenuOptions`, `PageKey` and `PageKeys` are exported types.
