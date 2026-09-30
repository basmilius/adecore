# Bridge

`@basmilius/desktop-shell/bridge` holds the shapes that cross IPC between the shell and its page. It imports nothing from Electron, so a preload and the page import it as well as the main process. A preload hands every answer to the page as `unknown`; one shape in one place keeps both ends from drifting apart without the compiler saying so.

| Name | What it is |
|---|---|
| `MenuSpec`, `MenuNode`, `MENU_ROLES`, `MenuRole` | The [application menu](/desktop-shell/menu) the page builds. |
| `UpdateState` | Where [updating](/desktop-shell/updater) stands. |
| `compareVersions`, `isVersion` | One ordering of versions for the shell and the page, so release notes land under the right heading. A version that is not a plain `1.2.3` sorts below every one that is. |
