# Document editing without a view

`@adecore/editor-core` holds text, selections, revisions, undo history, search, folding, and editing commands. It has no DOM or runtime dependencies. Use it for a document model in a browser, Node, or Bun. Add [`@adecore/editor`](/editor/handbook/) when a person needs to edit the text on screen.

The package is private at `0.0.0` while publication is being prepared. In a local Adecore checkout, a tool that selects the `source` export condition reads `src/index.ts`. The default export condition and TypeScript declarations read `dist`, which the package build creates. There is no published version implied by these examples.

```ts
import { DocumentModel } from '@adecore/editor-core';

const document = new DocumentModel('const count = 1;\n');
const before = document.getSnapshot();
const changed = document.applyEdits([{ from: 14, to: 15, text: '2' }], { expectedRevision: before.revision, source: 'external' });

if (changed) {
    document.undo();
}
```

`applyEdits` returns `false` for a stale revision or an edit that leaves the text unchanged. Invalid ranges throw before the model changes. Keep those outcomes separate in host code: a stale proposal needs a new calculation; a no-op needs no retry.

Read the handbook in this order:

1. [Text, positions, and selections](./document-model) explains coordinate systems and normalization.
2. [Transactions and history](./transactions) covers simultaneous edits, revision checks, and undo grouping.
3. [Events and state](./events-state) connects the model to a view or language client.
4. [Commands, search, and structure](./commands-structure) covers editing behavior and the exported helpers.
5. [Testing, resources, and provenance](./testing-provenance) records limits and licensing.

The package's only public entry point is its root. `TextRope`, lexical scanners, and change-mapping internals are implementation details. The root exports the `DocumentModel` class, the helpers described in this handbook, and their public types.
