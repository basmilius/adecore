# Geometry

Everything here works in world units, the coordinates the elements are stored in. A `Point` is `{ x, y }` and a `Rect` is `{ x, y, w, h }`. The app converts pointer pixels through its zoom and pan; no function reads the DOM.

<Demo src="canvas/drawing-hit-test" />

The demo asks `elementAt` what is under the pointer and draws its `boundsOf` with a handle at every `handlePoint`. The inside of the ellipse is no hit, because it has no fill.

## Bounds

- `boundsOf(element)` is the stored box of one element. `boundsOfElements(elements)` is the box around all of them, or `null` for none.
- `toSvg` and `elementsIn` use the stored box turned by the element's angle.
- `unionOf(rects)` is the box around any rects, or `null` for an empty list.
- `centerOf(rect)` is its middle. `roundPoint(point)` rounds to whole units.
- `rectFromPoints(from, to)` is the box of a drag in either direction, always with a positive size.
- `intersects(a, b)` is true when two boxes overlap. Touching is not overlapping.

No box includes the wobble, stroke width, arrow heads or text that runs past a note. Add room for those when you fit a view to its content.

## Rotation

`angle` turns an element around the center of its box, in radians. `rotatePoint(point, around, angle)` turns a point. Turn it by minus the element's angle around `centerOf(boundsOf(element))` to get it in the element's own frame.

## Hit tests

```ts
import { elementAt, elementsIn, rectFromPoints } from '@adecore/drawing';

const hit = elementAt(elements, pointer, 6 / zoom);
const picked = elementsIn(elements, rectFromPoints(dragStart, pointer));
```

`elementAt` decides each element after undoing its rotation:

| Kind                         | A hit                                                                    |
| ---------------------------- | ------------------------------------------------------------------------ |
| `rect`, `diamond`, `ellipse` | Anywhere inside when it has a fill, else near the outline                |
| `text`, `note`               | Anywhere inside the box; the tolerance does not widen it                 |
| `line`, `freehand`           | Near the polyline through its points, or near the only point of a stroke |

"Near" is within `tolerance` or the stroke width, whichever is larger, measured to the ideal outline without wobble.

`elementAt(elements, point, tolerance)` returns the topmost element hit, or `undefined`. `elementsIn(elements, rect)` returns every element whose drawn box overlaps the rect, in stacking order. Both skip `locked` elements. A lock only keeps an element out of selection, so check it again where the app writes.

## Resizing

`RESIZE_HANDLES` lists the eight handles of a box (`ResizeHandle`), clockwise from `nw`, and `handlePoint(rect, handle)` places one. While a handle is dragged, `resizeRect(rect, handle, pointer, aspect)` returns the new box with the opposite side fixed. With `aspect` set (usually Shift) the box keeps its proportions.

`resizeRect` does not clamp. A handle dragged past the opposite side gives a negative size, which the app normalizes or refuses before it stores the box.

```ts
import { boundsOf, resizeRect, scaleElement } from '@adecore/drawing';

const from = boundsOf(element);
const to = resizeRect(from, 'se', pointer, event.shiftKey);
const resized = scaleElement(element, from, to);
```

`scaleElement(element, from, to)` moves and scales an element from one box to another; for a selection, pass the box around all of it as `from`. It scales the points of a line or stroke. A text gets `sized: true`, so it wraps to its box from then on. The angle, seed, stroke width, font size and corner radius stay. Both functions work on the unturned box, so turn the pointer of a rotated element into its frame with `rotatePoint` first.
