# Edits and rebasing

A drawing can have more than one writer. A person draws in the editor on screen while an agent adds or changes elements. The second writer sends an edit by id instead of a whole document, and the editor rebases its unsaved edits when a newer document arrives. Both live on `@adecore/drawing`.

## Editing by id

```ts
import { DrawingEditSchema, applyDrawingEdit } from '@adecore/drawing';

const edit = DrawingEditSchema.parse({
    add: [{ kind: 'ellipse', x: 620, y: 40, w: 90, h: 90, stroke: 'orange', fill: 'solid', fillColor: 'yellow' }],
    update: [{ id: 'box', stroke: 'blue' }],
    remove: ['arrow']
});

const outcome = applyDrawingEdit(drawing.elements, edit, { id: () => crypto.randomUUID(), seed: () => Math.floor(Math.random() * 2 ** 31) });
```

`DrawingEditSchema` (type `DrawingEdit`) has three optional lists:

- `add` takes `NewDrawingElementSchema` (`NewDrawingElement`), an element without `id`, `seed` and `locked`. `stroke` defaults to `ink`, `strokeWidth` to `2`, and a text or note `size` to `20`.
- `update` takes `DrawingElementPatchSchema` (`DrawingElementPatch`), an `id` and the fields that change. The kind stays.
- `remove` takes ids.

Every level is strict, so a misspelled field fails on its path. Parse what an agent sends with the schema, and pass the problems back so it can correct its next edit.

## The outcome

`applyDrawingEdit` returns a `DrawingEditOutcome`. That is `{ ok: true, elements, added }` with the new ids in order, or `{ ok: false, problems }`, a list of `DrawingEditProblem` with a `path` and a `message`:

```ts
applyDrawingEdit(elements, { update: [{ id: 'arrow', text: 'Next' }] }, mint);
// { ok: false, problems: [{ path: ['update', 0, 'text'], message: 'arrow is a line, which has no field text' }] }
```

It applies all or nothing. These are problems:

- An unknown, locked or repeated id.
- A field of another kind, such as `text` on a `rect`.
- An edit beyond `DRAWING_EDIT_LIMITS`: more than 200 elements touched in one edit, or a drawing left with more than 5000 elements.

Updated elements keep their stacking place; added ones go on top. The `DrawingEditMint` makes the id and seed of each new element. Its ids must not be ones the drawing already holds.

## Rebasing unsaved edits

When a newer document arrives before the editor saved its own edits, the editor puts its edits on top by id.

```ts
import { rebaseDrawingElements } from '@adecore/drawing';

const outcome = rebaseDrawingElements(saved.elements, onScreen.elements, incoming.elements);

if (outcome.ok) {
    show(outcome.elements);
} else {
    askAbout(outcome.conflicts);
}
```

`rebaseDrawingElements(base, mine, theirs)` returns a `DrawingRebase`: `{ ok: true, elements }`, or `{ ok: false, conflicts }` with the ids both sides changed. `base` is the document both sides started from. A change on one side wins; the same change on both sides is no conflict. The stacking order follows the side that changed it, or `theirs` when neither or both did.
