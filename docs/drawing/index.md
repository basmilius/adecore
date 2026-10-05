# @adecore/drawing

Schemas, geometry and rendering for persisted drawings. The package supplies hit testing, resizing, deterministic shape paths, SVG strings and text reading order. It works in world coordinates without a DOM, React canvas or filesystem.

Use it to build a drawing host or export a stored document on a backend. The host supplies gestures, selection, persistence, revision checks, fonts and theme values. `@adecore/diagram` shares its geometry, palette names and export defaults.

The package is private at `0.0.0` pending initial publication. Its transferred code retains [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/drawing/LICENSE). Zod, Rough.js and perfect-freehand are declared dependencies with their own licenses. Rough.js loads through its official package entry, including for compiled Node execution.

## Read the documentation

- [Getting started](./getting-started) validates a document and produces SVG and reading output.
- [Geometry and editing](./geometry) explains coordinates, hit tests, rotation and resize behavior.
- [Paths and SVG](./rendering) covers seeds, paint roles, freehand, themes and XML handling.
- [Text, fonts and reading order](./text) covers wrapping, measurement and notes.
- [API reference](./api) groups every root export.
- [Drawing protocol](./protocol) describes persisted fields and validation.
- [Integration, migration and testing](./migration) covers host ownership, compatibility and troubleshooting.

The [standalone export example](https://github.com/basmilius/adecore/blob/main/packages/drawing/examples/export-drawing.ts) needs no UI. The package supplies no CSS, font downloads, keyboard bindings or accessible canvas component.
