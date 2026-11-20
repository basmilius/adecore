# CardGrid

Lays out [`Card`](/ui/layout/card)s with one 16 pixel gutter both ways. With a title it is a group of cards under a heading.

```tsx
import { CardGrid } from '@adecore/ui';
```

<Demo src="layout/card-grid" />

```tsx
<CardGrid columns={3}>
    <Card.Root span={2}>…</Card.Root>
    <Card.Root>…</Card.Root>
</CardGrid>
```

`columns` is 1, 2 (the default), 3 or 4. The grid answers to its own width, not the window's: once a column would be narrower than 280 pixels it falls back to one column.

A card sets its own place with `span` on `Card.Root`: a number of columns, or `full` for the whole row. A span never reaches past the grid, so a wide card in the one-column fallback is one column wide. Because the card reads its place from the grid around it, a component of your own that returns a `Card.Root` takes its `span` like any other card.

## Rows

The default `flow="grid"` lines the cards up in rows. Every card in a row is as tall as the tallest one, and its body takes the extra height, so a chart or a list can fill it. Give a card `className="self-start"` to keep its own height.

Any other element in the grid takes one place like a card.

## Masonry

`flow="masonry"` closes each card up under the one above it, in columns, and keeps every card at its own height. A card with `span="full"` runs across all columns; the cards after it start new columns under it. A span of 2 or 3 has no column to join in masonry, so it runs across the full row too.

<Demo src="layout/card-grid-masonry" />

## Groups

`title` puts a heading 12 pixels above the cards, with `icon` before it. The grid is then a section named by that heading, and the titles of its cards are one heading level below it.

A grid inside a grid takes the full row of the outer one, so the cards of two groups never share a column. Stack groups and the other blocks of a screen, such as a banner, in a `CardGrid` of one column: it keeps one gutter between them. A group without a title starts its own set of columns the same way. A group inside a group nests.

<Demo src="layout/card-grid-groups" />

`CardGrid` renders a `<div>`, or a `<section>` with a title, and takes its props, plus `render`. `CardGridProps`, `CardGridColumns`, `CardGridFlow` and `CardSpan` are exported types.
