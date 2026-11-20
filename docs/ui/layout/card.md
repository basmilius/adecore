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
| `Card.Root` | The card, a `<section>`. `ground` is `raised` (the default) or `surface`. `collapsible`, `open`, `defaultOpen` and `onOpenChange` fold it. |
| `Card.Header` | One line of at least 44 pixels. `title` is the heading, `icon` a 16 pixel Lucide icon before it. The children sit at the end in small muted text: a pill, a link, an icon button, a `Segmented`. |
| `Card.Body` | The content, padded 16 pixels. `flush` runs it to the edges. |

Every part takes the props of its element, plus `render` to draw another one.

The card is named by its title, so a screen reader announces it as a region. It is a container too, so its content can respond to the card's width with a container query (`@md:grid-cols-2`) instead of the window's.

## Header only, body only

Leave out the body for a card that says everything in its header, and the header for a card that is content only. Neither needs a prop.

<Demo src="layout/card-states" />

## Folding

`collapsible` adds a toggle at the end of the header. A folded card shows only its header, and hides the header's other children. `defaultOpen` sets where it starts; `open` and `onOpenChange` let you hold the state yourself.

## A table or list

`flush` drops the body's padding, for a table or list whose rows bring their own.

<Demo src="layout/card-flush" />

`CardRootProps`, `CardHeaderProps`, `CardBodyProps` and `CardGround` are exported types.
