# Getting started with Tree

Use `Tree` when your nodes have domain ids, not filesystem paths. Import the [theme](/ui/guide/getting-started) and mount [`UIProvider`](/ui/utilities/ui-provider) first. It supplies the translated chevron labels and shared formatting/input behavior.

## A controlled tree

This example has one branch and two leaf nodes. The host owns the visible rows and one roving tab stop. A leaf activation records its id; no backend command runs.

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

Selection stays independent from arrow-key focus in this example. Add selection-following-focus only if your host wants it. Modifier multi-selection, typeahead and virtualization are not implemented here; those belong to a larger model's navigation policy.

The ref map holds only mounted rows. A larger tree should reveal and mount a target before focusing it. When a branch collapses or a loaded node disappears, move focus to a surviving parent or neighbor before removing the focused element.

## Row layout

`level` starts at one. Indentation advances 16px per level and draws guides for ancestors. Leaves use `Tree.ChevronSlot` to align their labels with sibling branches. `Tree.Label` supplies end truncation, while `Tree.Decoration` remains at the trailing end.

`joinedStart` and `joinedEnd` visually join adjacent selected rows. Compute these from the visible selection rather than persisted node order. They change selection corners; they do not select other rows or implement range selection.
