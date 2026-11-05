# EmptyScene

A small drawing for an [`EmptyState`](/ui/status/empty-state): soft shapes with a thin rim, and one detail in the accent color.

```tsx
import { EmptyScene } from '@adecore/ui';
```

<Demo src="display/empty-scene" />

Its children are SVG in a 160 by 104 view box. `compact` draws it at 136 by 88 pixels, for a panel. The drawing is decoration, so it stays out of the accessibility tree.

## Classes

| Class | Draws |
| --- | --- |
| `scene-shape` | A surface with the gradient and the rim. |
| `scene-lift` | A soft shadow on a group of shapes. |
| `scene-edge` | A thin line on a surface. |
| `scene-inset` | A sunken part of a surface. |
| `scene-line` | A line between shapes. |
| `scene-text` | A thick line that stands for text. |
| `scene-hand` | A clock hand. |
| `scene-dot` | A neutral dot. |
| `scene-accent` | The one detail in the accent color, filled. |
| `scene-accent-line` | The same detail as a line. |
| `scene-cursor` | A pointer. |

## Motion

A scene plays one action on a loop of 8 seconds and stands still at the end of it. Without an animation class, a shape shows that end, so reduced motion needs nothing of its own.

| Class | Plays |
| --- | --- |
| `scene-loop` | Fades a group in and out around the loop. |
| `scene-reveal-0` to `scene-reveal-12` | A shape lands, one step of the loop after the other. |
| `scene-stroke-0` to `scene-stroke-12` | A path draws itself. Set `pathLength={1}`. |
| `scene-type-0` to `scene-type-12` | A path appears in steps, like typed text. Set `pathLength={1}`. |

`--scene-arrive` is the easing of what lands, for the animations of your own.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `children` | `ReactNode` | | Required. SVG. |
| `compact` | `boolean` | `false` | 136 by 88 pixels. |
| `className` | `string` | | |

`EmptySceneProps` is an exported type.
