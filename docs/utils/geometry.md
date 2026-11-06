# Geometry

```ts
import { centerOf, intersects, rectFromPoints, type Point, type Rect } from '@adecore/utils/geometry';
```

Points and boxes in whatever unit the caller draws in. A `Point` is `{ x, y }` and a `Rect` is `{ x, y, w, h }`. Nothing here reads the DOM, so it runs in a page, a worker and Node alike.

## Boxes

- `unionOf(rects)` is the box around any rects, or `null` for an empty list.
- `centerOf(rect)` is the middle of a box.
- `rectFromPoints(from, to)` is the box of a drag in either direction, always with a positive size.
- `intersects(a, b)` is true when two boxes overlap. Touching is not overlapping.

```ts
const marquee = rectFromPoints(dragStart, pointer);
const picked = nodes.filter((node) => intersects(node, marquee));
```

## Points

- `roundPoint(point)` rounds to whole units, for a layout that lines its boxes up on a pixel grid.
- `rotatePoint(point, around, angle)` turns a point around another by `angle` radians.
