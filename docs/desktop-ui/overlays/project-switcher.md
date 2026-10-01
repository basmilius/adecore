# ProjectSwitcher

A project name in the toolbar that opens a menu of projects, recent projects and per-project actions. The app supplies the list and handles each selection; the component keeps no project state and opens no folders or windows itself.

```tsx
import { ProjectSwitcher, type ProjectSwitcherItem, type ProjectSwitcherProps } from '@basmilius/desktop-ui';
```

<Demo src="overlays/project-switcher" />

## Projects

Each `ProjectSwitcherItem` has a stable `id` and a `name`. IDs must distinguish projects on different machines or in different workspaces. The component draws the arrays in the order supplied and does not filter them.

| Item field | What it draws |
| --- | --- |
| `icon` | A React node before the name, in the row and in the trigger when this is `current`. |
| `description` | A tooltip beside the row, for a folder path or connection details. |
| `hint` | Quiet text after the name, for a machine or workspace. |
| `disabled` | An unavailable project. Selection is disabled, but its actions stay reachable. |
| `muted` | A dimmed row that can still be selected, for a disconnected project the app can try to reconnect to. |
| `actions` | `Menu.Item` children in an actions submenu beside the row. Omit it to draw a single row. |

`projects` appear in the main menu. `recentProjects` appear under Recent projects when the array is nonempty. Either list can contain rows with actions.

## Selecting a project

`onSelect(project, event)` receives the original item and the click event. Add app-specific fields to your items; `ProjectSwitcherProps<Item>` preserves their type in the callback. The event carries modifier keys, so the app can handle Cmd-click or Ctrl-click by opening a separate window.

`current` supplies the trigger's name and icon. It may be absent from either list. With `current={null}`, the trigger reads Projects. `leading` adds a node before the current icon, such as a machine indicator with its own tooltip.

## Actions and state

The menu draws three groups. First come the open projects, then the menu items in `before`, then Recent projects together with the menu items in `children`. Put the ways to open a project in `children`, such as opening a folder or creating a project, so they share a group with Recent. Put what is neither a project nor a way to open one in `before`, such as a place or an action outside any project. A group with nothing in it draws no separator.

The menu keeps its open state by default. `defaultOpen` sets its initial state; `open` and `onOpenChange` control it. `disabled` disables the trigger. `label` overrides its accessible name, which defaults to the current project name, or Projects without a current project. `className` and `ref` reach the trigger button.

The component uses [Menu](/desktop-ui/overlays/menu) for keyboard navigation, typeahead, submenus and focus return. Typeahead matches the project name, without its hint. Labels use the library's English and Dutch `ui` namespace.
