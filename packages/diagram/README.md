# @adecore/diagram

[![npm](https://img.shields.io/npm/v/@adecore/diagram)](https://www.npmjs.com/package/@adecore/diagram)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev/diagram/)

Directed graphs that are written rather than drawn. A diagram file names its nodes, groups and edges; the package lays them out, routes the edges and writes the result as SVG or as lines of text. The same file gives the same picture on every machine, and it needs no DOM.

**[Documentation with live demos](https://adecore.dev/diagram/)**

## Install

```sh
bun add @adecore/diagram
```

## Use

```ts
import { layoutOf, readingOrder, toSvg } from '@adecore/diagram';
import { diagramProblemIn, migrateDiagram } from '@adecore/diagram/protocol';

const diagram = migrateDiagram(JSON.parse(file));
const problem = diagram && diagramProblemIn(diagram);
if (diagram === null || problem) {
    throw new Error(problem ?? 'Not a diagram');
}

const layout = layoutOf(diagram);
const svg = toSvg(diagram, { layout });
const lines = readingOrder(diagram);
```

## Entry points

| Import | What it holds |
|---|---|
| `@adecore/diagram` | Layout, SVG export, the shape and text helpers and reading order |
| `@adecore/diagram/protocol` | The Zod schemas and types of a diagram, and `diagramProblemIn` |

## Documentation

| Page | What it covers |
|---|---|
| [Documents](https://adecore.dev/diagram/documents) | Nodes, groups and edges, and checking a file |
| [Layout](https://adecore.dev/diagram/layout) | Layers, ordering, sizes, groups, edge routes and dragged nodes |
| [Painting and reading](https://adecore.dev/diagram/rendering) | `toSvg`, helpers for a painter of your own and `readingOrder` |

## License

FSL-1.1-MIT, see [LICENSE](./LICENSE).
