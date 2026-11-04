# Reading order

`readingOrder(content)` writes the graph as lines of text, for an agent that reads the diagram back or a text alternative next to the picture. Unlike the [reading order of a drawing](/drawing/reading-order) it guesses nothing, since the file already says what points at what.

```ts
import { readingOrder } from '@adecore/diagram';

const lines = readingOrder(diagram);
```

For the release diagram on the [overview](/diagram/):

```
Commit
Build (bun run build)
Test (bun test)
Approved?
Publish
Registry
Docs site
Commit -> Build
Build -> Test
Test -> Approved?: green
Approved? -> Publish: yes
Approved? -> Commit: changes
Publish -> Registry
Publish -> Docs site
CI wraps: Build, Test
```

## How it reads

- Nodes come column by column, in file order within a column, with their `sub` in parentheses.
- Then come the edges in file order, with labels after a colon.
- Then come the groups, each with the nodes it wraps.

A node with an empty label shows its id, and so does a group. Dragging changes nothing here, since a pinned node keeps its column.
