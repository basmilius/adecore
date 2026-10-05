# Geometry and editing

## World coordinates and element frames

`Point` is `{ x, y }`; `Rect` is `{ x, y, w, h }`. Values are world units. The host converts client coordinates through its zoom and pan transform before calling geometry helpers. No helper reads device pixel ratio or viewport state.

`boundsOf` copies an element's stored box. `centerOf` returns its midpoint, `roundPoint` rounds each coordinate, and `rectFromPoints` makes a nonnegative box from either drag direction. `unionOf` normalizes the extents it combines and returns `null` for no rectangles; `boundsOfElements` combines stored element boxes.

An optional `angle` is radians around the box's world center. `rotatePoint` rotates a world point; `toLocal` undoes an element's rotation but leaves the result in unrotated world coordinates. It does not subtract the element origin.

Line and freehand points are relative to `(x, y)`. `absolutePoints` adds the origin and returns `[]` for other kinds. It does not apply rotation. The points' extents and the stored `w`/`h` must stay consistent in the host.

Bounds do not include rotation, rough wobble, arrowheads, stroke thickness or text overflow. Marquee selection and SVG export use those boxes. Compute expanded visual bounds in the host when clipping or fit-to-content must include all painted pixels.

## Hit testing

`hitsElement(element, point, tolerance)` undoes rotation before testing. For shape outlines and line segments, the effective reach is the larger of `tolerance` and `strokeWidth`.

| Kind                   | Hit behavior                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| Rect, diamond, ellipse | Filled shapes accept interior hits; absent/`none` fill tests near the outline |
| Text, note             | Accept any point in the stored box; tolerance does not enlarge it             |
| Line, freehand         | Test distance to the polyline, including a single freehand point              |

These are ideal geometry tests. Rect corner radius, rough path wobble, freehand painted width and arrowhead geometry do not change the hit outline.

`hitsElement` does not consider `locked`. `elementAt` searches the element array from front to back and skips locked elements; it returns `undefined` when nothing hits. `elementsIn` returns unlocked elements whose stored boxes intersect the marquee, in input order. It tests intersection, not full containment. `intersects` uses strict overlap, so rectangles that only touch at an edge do not intersect.

```ts
import { elementAt, elementsIn, rectFromPoints } from '@adecore/drawing';
import type { DrawingElement } from '@adecore/drawing/protocol';

const elements: DrawingElement[] = [
    { kind: 'rect', id: 'back', x: 0, y: 0, w: 100, h: 60, stroke: 'ink', strokeWidth: 2, seed: 1, fill: 'solid' },
    { kind: 'rect', id: 'front', x: 0, y: 0, w: 100, h: 60, stroke: 'red', strokeWidth: 2, seed: 2, fill: 'solid', locked: true }
];
console.log(elementAt(elements, { x: 50, y: 30 }, 4)?.id);
console.log(elementsIn(elements, rectFromPoints({ x: 90, y: 50 }, { x: 110, y: 70 })).map((element) => element.id));
```

Both selections include only `back`. Locked is a selection convention, not an authorization boundary; the host must protect locked items from its own write operations.

## Resize and scaling

`RESIZE_HANDLES` lists `nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`. `handlePoint` places a handle on a box. `resizeRect(rect, handle, point, aspect = false)` follows the pointer and anchors the opposite side. It is an unrotated-box operation.

With `aspect: true` and positive original dimensions, side handles derive the other dimension from the original ratio; corners use the smaller pull. No minimum size is imposed. Crossing the opposite side can return negative dimensions. Normalize the result or constrain the gesture before storing it; `resizeRect` does not normalize it itself.

`scaleElement(element, from, to)` scales position and size relative to a source selection box. It scales relative line/freehand points, preserves freehand pressure and marks text as `sized: true`. It keeps angle, seed, stroke width, font size and radius unchanged. A zero source width or height uses a scale of one for that axis.

```ts
import { boundsOf, resizeRect, scaleElement } from '@adecore/drawing';
import type { DrawingElement } from '@adecore/drawing/protocol';

const element: DrawingElement = {
    kind: 'line',
    id: 'line',
    x: 0,
    y: 0,
    w: 100,
    h: 50,
    stroke: 'ink',
    strokeWidth: 2,
    seed: 3,
    points: [
        [0, 0],
        [100, 50]
    ]
};
const from = boundsOf(element);
const to = resizeRect(from, 'se', { x: 200, y: 100 }, true);
const resized = scaleElement(element, from, to);
console.log(resized.w, resized.h);
```

For rotated gestures, the host first converts the pointer to the intended resize frame, then applies its placement policy. These helpers do not manage selection handles, undo, snapping, persistence or event listeners.
