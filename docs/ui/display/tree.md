# Tree

The rows of a [`FileTree`](/ui/display/file-tree), as parts, for nodes whose identity is not a file path: connections, schemas, objects in a store. The parts draw; selection, expansion, loading and keyboard navigation are yours.

```tsx
import { Tree } from '@adecore/ui';
```

<Demo src="display/tree" />

## Parts

| Part | What it is |
| --- | --- |
| `Tree.Root` | The container, with `role="tree"`. Name it with `aria-label` or `aria-labelledby`. |
| `Tree.Row` | One `role="treeitem"`, 25 pixels tall, with its `level`, `selected` state, indentation guides and the accent outline under the keyboard. |
| `Tree.Chevron` | The button that opens or closes a branch without selecting its row. |
| `Tree.ChevronSlot` | The empty space of a chevron, so a leaf lines up with the branches beside it. |
| `Tree.Label` | The name, cut off at the end. |
| `Tree.Decoration` | Content at the end of the row, such as a count. |
| `Tree.Control` | Wraps an interactive control so its events never reach the row. |
| `Tree.Checkbox` | A [`Checkbox`](/ui/inputs/checkbox) inside a `Tree.Control`, with real mixed and disabled states. |

Every part takes `className`, `ref` and Base UI's `render` prop, except `Tree.Checkbox`. Keep a row that holds controls a `<div>`: a row rendered as a button would nest other buttons inside it.

`level` starts at 1, and each level indents 16 pixels and draws a guide for every ancestor. `joinedStart` and `joinedEnd` square the corners between adjacent selected rows; compute them from the visible rows. They change the look only.

## Keyboard and focus

A row handles no key and is no tab stop by itself. This tree with one branch keeps one tab stop that moves with the arrow keys, opens and closes the branch with the left and right arrows, and activates a leaf on Enter:

```tsx
import { useRef, useState, type KeyboardEvent } from 'react';
import { Tree } from '@adecore/ui';

export function ObjectTree() {
    const [expanded, setExpanded] = useState(true);
    const [selected, setSelected] = useState('group');
    const [focused, setFocused] = useState('group');
    const [opened, setOpened] = useState<string | null>(null);
    const elements = useRef(new Map<string, HTMLDivElement>());
    const rows = expanded ? ['group', 'customers', 'orders'] : ['group'];

    const focus = (id: string): void => {
        setFocused(id);
        elements.current.get(id)?.focus();
    };
    const activate = (id: string): void => {
        setSelected(id);
        if (id === 'group') {
            setExpanded((value) => !value);
        } else {
            setOpened(id);
        }
    };
    const onKey = (event: KeyboardEvent<HTMLDivElement>, id: string): void => {
        if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
            return;
        }
        const index = rows.indexOf(id);
        switch (event.key) {
            case 'ArrowDown':
                focus(rows[Math.min(index + 1, rows.length - 1)]!);
                break;
            case 'ArrowUp':
                focus(rows[Math.max(index - 1, 0)]!);
                break;
            case 'Home':
                focus(rows[0]!);
                break;
            case 'End':
                focus(rows[rows.length - 1]!);
                break;
            case 'ArrowRight':
                if (id === 'group') {
                    if (expanded) {
                        focus('customers');
                    } else {
                        setExpanded(true);
                    }
                }
                break;
            case 'ArrowLeft':
                if (id === 'group') {
                    setExpanded(false);
                } else {
                    focus('group');
                }
                break;
            case 'Enter':
                activate(id);
                break;
            case ' ':
                setSelected(id);
                break;
            default:
                return;
        }
        event.preventDefault();
    };

    return (
        <div>
            <Tree.Root aria-label="Data objects">
                {rows.map((id, index) => (
                    <Tree.Row
                        key={id}
                        ref={(element) => {
                            if (element) {
                                elements.current.set(id, element);
                            } else {
                                elements.current.delete(id);
                            }
                        }}
                        level={id === 'group' ? 1 : 2}
                        selected={selected === id}
                        tabIndex={focused === id ? 0 : -1}
                        aria-expanded={id === 'group' ? expanded : undefined}
                        aria-setsize={id === 'group' ? 1 : 2}
                        aria-posinset={id === 'group' ? 1 : index}
                        onFocus={() => setFocused(id)}
                        onClick={() => {
                            focus(id);
                            activate(id);
                        }}
                        onKeyDown={(event) => onKey(event, id)}
                    >
                        {id === 'group' ? (
                            <Tree.Chevron
                                expanded={expanded}
                                onExpandedChange={(value) => {
                                    if (!value && focused !== 'group') {
                                        focus('group');
                                    }
                                    setExpanded(value);
                                }}
                            />
                        ) : (
                            <Tree.ChevronSlot />
                        )}
                        <Tree.Label>{id === 'group' ? 'Store' : id}</Tree.Label>
                    </Tree.Row>
                ))}
            </Tree.Root>
            {opened !== null && <p>Opened {opened}</p>}
        </div>
    );
}
```

Selection here does not follow focus, and there is no selection with a modifier, no typeahead and no virtualization; those belong to the navigation of a larger model. The ref map holds only the rows that are drawn, so a larger tree draws a row before it focuses it. When a branch closes or a node disappears, move the focus to a parent or a neighbor first.

The [reference](/ui/display/tree/reference) lists every prop and covers loading, controls and menus. [`DatabaseExplorer`](/database/views/explorer) is a complete tree built on these parts.
