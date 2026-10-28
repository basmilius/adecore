# ProjectSwitcher

A project name in a toolbar that opens a menu of projects, recent projects and their actions. The app passes the lists and handles each pick; the component holds no project state.

```tsx
import { ProjectSwitcher } from '@adecore/ui';
```

<Demo src="overlays/project-switcher" />

## Projects

Each `ProjectSwitcherItem` has an `id`, unique within its list, and a `name`. The lists are drawn as given, in order and unfiltered.

| Item field | What it draws |
| --- | --- |
| `icon` | A node before the name, in the row and in the trigger when this is `current`. |
| `description` | A tooltip beside the row, for a folder path or connection details. |
| `hint` | Quiet text at the end of the row, for a machine or workspace. |
| `disabled` | A project that cannot be picked. Its actions stay reachable. |
| `muted` | A dimmed row that can still be picked, for a disconnected project the app can try to reopen. |
| `actions` | `Menu.Item`s in a submenu beside the row. |

`projects` fill the top of the menu. A nonempty `recentProjects` adds a Recent projects submenu.

`onSelect(project, event)` receives the original item and the click event, whose modifier keys let the app open a project in a new window on Cmd-click. `ProjectSwitcherProps<Item>` keeps your own item type.

`current` gives the trigger its name and icon, and need not be in either list. `leading` adds a node before the current icon, such as a machine indicator.

## Without a current project

With `current={null}` the trigger shows `label`, or "Projects" (`projectSwitcher.label`) without one. With a current project, the accessible name joins both, such as "Product: Studio".

<Demo src="overlays/project-switcher-empty" />

## Groups

The menu has three groups: the projects, the items in `before`, and Recent projects with the items in `children`. Put ways to open a project (open a folder, create one) in `children`. Empty groups draw no separator.

`ProjectSwitcherGroups` draws the same groups inside a `Menu.Popup` of your own, such as behind a plus button. It takes `projects`, `recentProjects`, `before`, `children` and `onSelect`.

```tsx
<Menu.Root>
    <IconButton render={<Menu.Trigger />} icon={Plus} label="Open project" />
    <Menu.Popup className="min-w-60">
        <ProjectSwitcherGroups projects={projects} onSelect={open} />
    </Menu.Popup>
</Menu.Root>
```

Keyboard, typeahead and submenus come from [Menu](/ui/overlays/menu). Typeahead matches the project name, not its hint.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `current` | `ProjectSwitcherItem \| null` | | Required. |
| `projects` | `readonly Item[]` | | Required. |
| `onSelect` | `(project: Item, event: MouseEvent<HTMLElement>) => void` | | Required. |
| `recentProjects` | `readonly Item[]` | `[]` | |
| `leading` | `ReactNode` | | |
| `before` | `ReactNode` | | Menu items between the projects and Recent projects. |
| `children` | `ReactNode` | | Menu items in the group of Recent projects. |
| `label` | `string` | `projectSwitcher.label` | The trigger's text while `current` is null; prefixes the accessible name otherwise. |
| `disabled` | `boolean` | | |
| `tabIndex` | `number` | | On the trigger. |
| `open`, `defaultOpen`, `onOpenChange` | | | As on `Menu.Root`. |
| `className` | `string` | | On the trigger. |
| `ref` | `Ref<HTMLButtonElement>` | | The trigger. |

`ProjectSwitcherProps` and `ProjectSwitcherItem` are exported types.
