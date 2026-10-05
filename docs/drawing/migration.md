# Integration, migration and testing

## Host responsibilities

Parse data, check duplicate ids, then apply any host geometry and size limits. Neither `toSvg` nor hit testing performs those checks. Store element ids and seeds unchanged when editing unrelated fields.

The host owns document location, authentication, editing permissions, input gestures, selection, undo and revision-aware persistence. Compare a writer's expected revision with the current stored `rev`, then save content with an incremented revision atomically. Core schemas only require that a revision is a nonnegative integer.

The core registers no events and holds no host resources. A custom painter must dispose its own listeners and canvas resources. Theme changes require new resolved palette values; changed fonts may require measuring and repainting text. The package has no CSS, i18n provider or font installation step.

## Protocol composition and migration

1. Replace behavior imports with `@adecore/drawing`. Keep fonts, palette resolution and measurement adapters supplied by the host.
2. Re-export generic schemas from `@adecore/drawing/protocol`, including `DrawingFontSchema` when other host rendering schemas share it.
3. Compose open, save, copy and changed payloads around the generic content/document schemas. Preserve host identity fields, wire-table order and revision conflicts.
4. Keep document version `1`, stacking order, ids, seeds, radians and absent optional fields. The namespace change needs no content rewrite.
5. Compare stored fixtures, generated-client output, hit tests and exported drawings before replacing the prior implementation.

Compiled consumers need built declarations and JavaScript in `dist`. Linked source consumers enable the `source` condition in the bundler and TypeScript. Browser and backend imports work without an application checkout. Backend wrapping uses an estimate unless the host injects a measure.

## Checks

From the repository root:

```sh
bun run --cwd packages/drawing typecheck
bun run --cwd packages/drawing test
```

The tests cover schema round trips, absent defaults, geometry, deterministic paths, notes, wrapping, XML text handling and inferred reading order. The [standalone example](https://github.com/basmilius/adecore/blob/main/packages/drawing/examples/export-drawing.ts) validates and exports one note. Add host regressions for revision conflicts, coordinate conversion under zoom, font loading and theme changes. Verify both source and default compiled imports under the intended runtime.

A string comparison can verify deterministic paths. Browser inspection is still needed for exact font metrics, rotated exports and clipping. Reading output alone does not establish a canvas's accessibility.

## Troubleshooting

| Symptom                                | Cause and next step                                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Duplicate ids parse successfully       | Run `duplicateElementIdIn` after the schema.                                                                                |
| A filled shape is hard to select       | Check whether `fill` is absent or `none`; only outline hits then count.                                                     |
| Marquee misses a rotated corner        | It uses stored unrotated bounds. Supply a host visual-bounds policy.                                                        |
| Resize produces a negative box         | The handle crossed its opposite side. Normalize or constrain the gesture.                                                   |
| Shape wobble changes after moving      | Retain its seed and local geometry. Position alone does not change paths.                                                   |
| SVG text wraps differently             | Match the actual font and use a real measurement adapter.                                                                   |
| A note's text runs below its paper     | Wrapping controls width only. Resize height in the host.                                                                    |
| Exported colors disappear elsewhere    | Resolve CSS variables into portable colors before export.                                                                   |
| Rotated SVG shifts at a nonzero origin | The current export pivot differs from the local path frame. See [export limits](./rendering#xml-and-current-export-limits). |
| `dist` cannot be resolved              | Build the package or deliberately enable source exports.                                                                    |
