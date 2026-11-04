# Reviews and agents

These parts draw what an agent proposed or wrote. Asking the agent, keeping its proposals and deciding who may accept them stay with the app. A read-only diff of a whole file is a [`DiffView`](/editor-react/diff-view).

## ChangeReview

<Demo src="editor/change-review" />

`ChangeReview` (`ChangeReviewProps`) draws a proposed change to a stretch of the file in the editor's font and colors: removed lines faded with `-`, added lines with `+`, replaced words in a stronger tint. It belongs in an [editor row](#rows-and-actions-in-react) under the stretch.

| Prop        | Type        | Meaning                                                |
| ----------- | ----------- | ------------------------------------------------------ |
| `editor`    | `Editor`    | The editor whose `renderCode` draws the lines          |
| `selected`  | `string`    | The text as it stands                                  |
| `proposal`  | `string`    | The text as proposed                                   |
| `startLine` | `number`    | The one-based number of the first line; `1` by default |
| `label`     | `string`    | The accessible name of the review                      |
| `actions`   | `ReactNode` | Drawn under the diff, such as Accept and Reject        |
| `className` | `string`    | On the outer `section`                                 |

The component accepts nothing itself. Guard the stretch with a [tracked range](/editor/editing#tracked-ranges) and apply the proposal over it:

```ts
const current = tracked.get();

if (current !== null && editor.textInRange(current) === selected) {
    editor.applyEdits([{ range: current, text: fitReplacement(selected, proposal) }]);
}
```

[Proposals](/editor-react/models#proposals-and-diffs) describes `fitReplacement` and `parseAnswer`.

## AttributionCard

<Demo src="editor/attribution-card" />

`AttributionCard` (`AttributionCardProps`) describes a run of lines an agent wrote, placed at the `rect` that [`onAttributionHover`](/editor/agents#attribution-marks) reports.

| Prop                | Meaning                                                         |
| ------------------- | --------------------------------------------------------------- |
| `rect`              | Where the bar is, in page pixels                                |
| `title`, `subtitle` | Such as the agent's name and what it did                        |
| `metadata`          | A line of the app's own under the title                         |
| `prompt`            | What the agent was asked, quoted                                |
| `color`, `icon`     | The agent's color and an icon; a dot in that color by default   |
| `actions`           | Buttons under the card                                          |
| `onHold(inside)`    | The pointer entered or left the card, to keep it open meanwhile |

## Rows and actions in React

The editor recreates a widget row's element whenever the row scrolls back into view. `RowHost` tracks those elements so React can portal into them:

```tsx
const rows = new RowHost(editor, 'review');
rows.set([{ id: 'proposal', line: 7, placement: 'below', height: 120 }]);

// In the component:
const containers = useSyncExternalStore(
    (listener) => rows.subscribe(listener),
    () => rows.getContainers()
);
const container = containers.get('proposal');

return container === undefined ? null : createPortal(<ChangeReview editor={editor} {...review} />, container);
```

`getContainers` returns a new map only when an element comes or goes. Call `subscribe` and `getContainers` on the host, since they are methods, not free functions. Outside a render, `container(id)` and `getVersion` read the live state.

`set(rows)` replaces the owner's rows, and `clear()` removes them. A `HostedRow` with `fixed` has an exact height; one with `filler` draws a hatched spacer without a portal. Keep state outside the element, since it comes and goes.

`LineActionHost(editor, owner)` does the same for [line actions](/editor/rows#line-actions). `set` takes `HostedAction`s, `{ id, line }` with a zero-based line, and an element lives as long as its action, so React state in it survives.

The editor has one set of line highlights, which a review and a conflict may share. `highlightLayers(editor)` returns its `HighlightLayers`. `set(owner, provider)` takes a function returning that owner's current highlights, and `set(owner, null)` removes them.

## One file in several editors

When two editors in a window show the same file, an answer to a review in one is an answer in both. `joinReviewGroup(key)` returns the `ReviewGroup` of a file key the host chooses, such as the path, and a `leave()` that releases it with its last editor. Each editor's review joins the group as a `ReviewMember` with `hide(runIds)`, `show(runIds)` and `refresh()`. The group calls them on every member, so a run the person accepted in one editor leaves the other at once.

```ts
const { group, leave } = joinReviewGroup(path);
const stop = group.join({ hide: (ids) => review.hide(ids), show: (ids) => review.show(ids), refresh: () => review.reload() });

// An answer in this editor:
group.hide(['run-3']);

// When the editor closes:
stop();
leave();
```

`hide` hides runs before the host answers, and `show` restores them when the host refuses.
