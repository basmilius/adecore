# Card

A block of a screen: a bordered surface with an optional one-line header and a body. Use it for a group of facts, a chart or a short list on a dashboard or an overview. For a card that floats over content, use a [`Surface`](/ui/display/surface).

```tsx
import { Card } from '@adecore/ui';
```

<Demo src="layout/card" />

```tsx
<Card.Root>
    <Card.Header title="Device" icon={Info}>
        <Pill tone="muted">paired</Pill>
    </Card.Header>
    <Card.Body>…</Card.Body>
</Card.Root>
```

## Parts

| Part | What it is |
| --- | --- |
| `Card.Root` | The card, a `<section>`. `ground` is `raised` (the default) or `surface`. `collapsible`, `open`, `defaultOpen` and `onOpenChange` fold it. `span` sets its place in a [`CardGrid`](/ui/layout/card-grid). |
| `Card.Header` | One line of at least 44 pixels. `title` is the heading, `icon` a 16 pixel Lucide icon before it. The children sit at the end in small muted text: a pill, a link, an icon button, a `Segmented`. `toggle` places the fold toggle at the `start` or the `end` (the default). |
| `Card.Body` | The content, padded 16 pixels. `flush` runs it to the edges. |
| `Card.Footer` | One line at the bottom edge, under a hairline: a summary, a link to more, actions. |

Every part takes the props of its element, plus `render` to draw another one.

The card is named by its title, so a screen reader announces it as a region. It is a container too, so its content can respond to the card's width with a container query (`@md:grid-cols-2`) instead of the window's.

Plain text or a link at either end of the header or footer lines up with the body's 16 pixel edge. Any other element there counts as a box and moves into the corner, 8 pixels from the edge. An icon button sits exactly as far from the edge as from the top and bottom of the line, at any size.

## Header only, body only

Leave out the body for a card that says everything in its header, and the header for a card that is content only. Neither needs a prop.

<Demo src="layout/card-states" />

## Folding

`collapsible` adds a toggle at the end of the header. A folded card shows only its header, and hides the header's other children and the footer. `defaultOpen` sets where it starts; `open` and `onOpenChange` let you hold the state yourself.

`toggle="start"` puts the toggle before the icon and title instead. Only the header row moves to make room for it: the body and footer keep their 16 pixel edge, and the header's children stay at the end.

<Demo src="layout/card-toggle" />

## A table or list

`flush` drops the body's padding, for a table or list whose rows bring their own.

<Demo src="layout/card-flush" />

## Footer

`Card.Footer` stays at the bottom edge, also when a grid stretches the card taller than its content. The body takes the height in between and hands it on as a column, so a chart or a list in it can grow into it or scroll. A card with a header and a footer needs no body.

<Demo src="layout/card-footer" />

`CardRootProps`, `CardHeaderProps`, `CardBodyProps`, `CardFooterProps` and `CardGround` are exported types.
