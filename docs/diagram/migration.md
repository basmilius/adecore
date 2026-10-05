# Integration, migration and testing

## Host boundaries

Parse content and run `diagramProblemIn` before saving or laying it out. The core accepts caller-owned content and performs synchronous calculations. It registers no listeners, starts no worker and requires no disposal. A UI owns its gestures, canvas resources and async layout scheduling.

The host owns persistence, authorization and expected-revision comparison. Increment `rev` atomically when committing a graph change. A schema parse does not authenticate a writer or establish that its revision is current.

Cache layouts only while their content is unchanged. Editing a label changes box size; editing groups, direction, edges or pins changes routes and bounds. A palette change can reuse a layout, but a font change still requires visual verification because layout uses estimated metrics.

For a draggable node, write its `pos`. To reset it, remove `pos`; do not store a current automatic coordinate as a permanent pin. Selection, keyboard actions, undo, readable errors and focus stay in the host. No CSS or i18n provider is required by this core.

## Migration

1. Replace core imports with `@adecore/diagram` and keep the matching drawing dependency available.
2. Re-export generic protocol names in the host's contracts. Compose transport identity, load/save payloads and changed events separately.
3. Preserve version `1`, revisions, file order, optional-field omission and pin coordinates. Run graph validation separately from schema parsing.
4. Keep theme overrides and host persistence behavior. A package rename alone requires no content rewrite or full wire protocol bump.
5. Compare persisted fixtures, generated clients, layers, route indices, SVG and reading order before replacing the old core.

Build drawing before diagram for default declaration/JavaScript imports. Enable `source` for linked development in both bundler and TypeScript. The root works under Node/Bun and browsers; the protocol entry point avoids renderer dependencies.

## Checks

From the repository root:

```sh
bun run --cwd packages/diagram typecheck
bun run --cwd packages/diagram test
```

Tests cover graph limits, ids, cycles, directions, deterministic integer layout, groups, long edges, labels, shapes, SVG escaping and reading output. Generated graph tests exercise automatic routing. They do not establish collision-free output for arbitrary pins or fonts.

The [standalone example](https://github.com/basmilius/adecore/blob/main/packages/diagram/examples/export-graph.ts) parses and checks a graph before export. Add host checks for stale saves, layout-cache invalidation, manual overlap handling and actual font rendering. Verify both source and compiled consumers outside the application.

## Troubleshooting

| Symptom                                     | Cause and next step                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| An invalid edge parses                      | Schemas check shape. Run `diagramProblemIn` for references and limits.                          |
| A cycle changes ordering after a reorder    | Cycle ranking depends on file order. Preserve it when layout continuity matters.                |
| Output arrays do not match visual row order | Arrays stay in file order; layout sweeps can reorder visual positions.                          |
| A group disappears                          | Empty groups have no layout box.                                                                |
| A node stays where it was after relayout    | It has `pos`. Remove it to restore automatic placement.                                         |
| A dragged node overlaps a group or route    | Pins do not reserve automatic-layout space. Resolve overlaps in the host.                       |
| Labels overflow with a custom font          | Sizing is estimated and has no font-engine adapter. Verify the host font or adjust its content. |
| Export crashes after an edit                | A supplied layout can be stale. Recompute for the current content.                              |
| Long labels create large channels           | Labels need space; graph limits do not limit text length. Add host input limits if required.    |
