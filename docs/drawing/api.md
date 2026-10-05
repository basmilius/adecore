# API reference

The root `@adecore/drawing` exports the groups below. Persisted schemas and `DrawingElement` are on [the protocol entry point](./protocol). Calls are synchronous except for host adapters that the host itself creates.

## Geometry

| Export                           | Inputs and result                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `Point`, `Rect`                  | `{ x, y }` and `{ x, y, w, h }`, numeric world units                                   |
| `RESIZE_HANDLES`, `ResizeHandle` | Eight cardinal/corner handles in clockwise order starting at `nw`                      |
| `boundsOf`                       | Element box fields to a copied `Rect`                                                  |
| `centerOf`, `roundPoint`         | Rectangle to midpoint; point to rounded point                                          |
| `rotatePoint`                    | `(point: Point, around: Point, angle: number): Point`; radians                         |
| `toLocal`                        | `(element: DrawingElement, point: Point): Point`; undoes rotation in world coordinates |
| `unionOf`                        | `(rects: readonly Rect[]): Rect \| null`                                               |
| `boundsOfElements`               | `(elements: readonly DrawingElement[]): Rect \| null`                                  |
| `intersects`                     | `(a: Rect, b: Rect): boolean`; strict overlap                                          |
| `rectFromPoints`                 | `(from: Point, to: Point): Rect`; nonnegative dimensions                               |
| `distanceToSegment`              | `(point: Point, a: Point, b: Point): number`                                           |
| `absolutePoints`                 | `(element: DrawingElement): Point[]`; no rotation                                      |
| `hitsElement`                    | `(element, point, tolerance): boolean`; does not skip locks                            |
| `elementAt`                      | `(elements, point, tolerance): DrawingElement \| undefined`; topmost unlocked hit      |
| `elementsIn`                     | `(elements, rect): DrawingElement[]`; unlocked intersecting boxes                      |
| `handlePoint`                    | `(rect: Rect, handle: ResizeHandle): Point`                                            |
| `resizeRect`                     | `(rect, handle, point, aspect = false): Rect`; can return negative dimensions          |
| `scaleElement`                   | `(element: DrawingElement, from: Rect, to: Rect): DrawingElement`                      |
| `arrowHead`                      | `(tip: Point, from: Point, size: number): [Point, Point][]`; two head segments         |
| `arrowHeadSize`                  | `(strokeWidth: number): number`; `12 + strokeWidth * 4`                                |

See [Geometry and editing](./geometry) for bounds, lock and scaling invariants.

## Paths and SVG

| Export                                             | Inputs and result                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ElementPath`                                      | `{ d: string; role: 'stroke' \| 'fill' \| 'ink'; strokeWidth: number; dash: number[] \| null }` |
| `outlineToPath`                                    | `(outline: readonly (readonly number[])[]): string`; closed local path                          |
| `freehandOutline`                                  | `(element: DrawingElement & { kind: 'freehand' }): string`                                      |
| `pathsOfElement`                                   | `(element: DrawingElement): ElementPath[]`; text produces `[]`                                  |
| `SvgOptions`                                       | Required palette plus optional paper, edge, background, margin, fonts and measure               |
| `DEFAULT_SVG_MARGIN`                               | `32` world units                                                                                |
| `DEFAULT_PALETTE`, `DEFAULT_PAPER`, `DEFAULT_EDGE` | Complete `Record<DrawingColor, string>` fallbacks                                               |
| `toSvg`                                            | `(elements: readonly DrawingElement[], options: SvgOptions): string`                            |

All [SVG options](./rendering#export-options) are host supplied. No function parses or sanitizes those options as document input.

## Writing and reading

| Export                        | Inputs and result                                                   |
| ----------------------------- | ------------------------------------------------------------------- |
| `LINE_HEIGHT`                 | `1.25`                                                              |
| `DEFAULT_FONT_STACKS`         | `Record<DrawingFont, string>`                                       |
| `WrittenElement`              | `DrawingElement` narrowed to text or note                           |
| `NOTE_PADDING`, `NOTE_RADIUS` | `16` and `8` world units                                            |
| `writingFrameOf`              | `(element: WrittenElement): { x: number; y: number; w: number }`    |
| `textLines`                   | `(text: string): string[]`; LF splitting                            |
| `MeasureLine`                 | `(line: string) => number`                                          |
| `approximateMeasure`          | `(size: number, font: DrawingFont \| undefined): MeasureLine`       |
| `wrapLines`                   | `(text: string, maxWidth: number, measure: MeasureLine): string[]`  |
| `linesOf`                     | `(element: WrittenElement, measure: MeasureLine): string[]`         |
| `fontOf`                      | `(font: DrawingFont \| undefined): DrawingFont`; missing means hand |
| `readingOrder`                | `(elements: readonly DrawingElement[]): string[]`                   |

See [Text, fonts and reading order](./text) for wrapping and heuristic limits. Sources: [geometry](https://github.com/basmilius/adecore/blob/main/packages/drawing/src/geometry.ts), [paths](https://github.com/basmilius/adecore/blob/main/packages/drawing/src/paths.ts), [text](https://github.com/basmilius/adecore/blob/main/packages/drawing/src/text.ts) and [SVG](https://github.com/basmilius/adecore/blob/main/packages/drawing/src/svg.ts).
