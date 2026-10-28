# Markdown and text

A plan reads and writes as a Markdown task list, for a person to paste or an agent to write. `renderPlanText` writes the compact form an agent reads back, with the ids it needs for its next operations.

<Demo src="canvas/plan-markdown" />

The demo runs the Markdown on the left through `parsePlanMarkdown` and `createPlan`, and prints `renderPlanText` on the right.

## Markdown

| Markdown                                | Plan                                                               |
| --------------------------------------- | ------------------------------------------------------------------ |
| `# Title`, once, before everything else | The title                                                          |
| Text before the first item              | The summary                                                        |
| `## Section`                            | A section                                                          |
| Text right under a section heading      | The section's description                                          |
| `- [ ] Step`                            | A step, with the [state marker](/plan/plans#state) in the brackets |
| A list item indented under a step       | A sub-step                                                         |
| Indented text under a step              | The step's description                                             |
| An indented `> note` under a step       | The step's note                                                    |
| `> **Title** text`                      | A text block                                                       |
| `---`                                   | Ends a section; what follows is at the top                         |

`parsePlanMarkdown(markdown)` returns `{ ok: true, draft }`, a [draft](/plan/plans#creating-a-plan) for `createPlan`, or a `plan-invalid` refusal that names the line. It reads `-`, `*` and `+` items, and an item without a checkbox as an open step. It refuses an unknown marker, a `###` heading and text that belongs to nothing. A marker on a parent step is dropped. `createPlan` checks the limits.

`planToMarkdown(plan)` writes the same format, four spaces per level. A parent step gets the marker of its derived state. Text that would read as markup gets an escaping backslash.

Markdown carries content, not identity. It leaves out ids, `rev`, `by` and `at`, checks, unlocks, the kind and the status. A plan read back is a new plan with new ids and every state recorded as the agent's. Store plans as JSON.

## Text for an agent

```
Plan "Ship the release" (release, steps, rev 0): 2 of 5 done
Summary: Everything that has to happen before a version goes out. Now: "Tests" [item-5]

## Prepare [item-1] 2/3
  [x] 1 Write the changelog [item-2]
  [~] 2 Run the checks [item-3] 1/2
    [x] 2.1 Typecheck [item-4]
    [~] 2.2 Tests [item-5]: "Two snapshots to update"

## Release [item-6] 0/2
  Heads-up [item-7]: A published version cannot be taken back.
  [ ] 1 Approve the release [item-8]
  [ ] 2 Publish to npm [item-9]
```

`renderPlanText(plan, options)` writes one line per item with its id in brackets, so the ids survive when a conversation is compacted. A step shows who may check it (`agent-only`, `person-only` or `unlocked`) and `set by a person` with the time. Parents and sections show how many of their steps are finished. Descriptions and notes are folded onto one line. `PLAN_LEGEND` explains the markers in one line and `PLAN_STATE_MARKERS` maps each state to its marker.

`PlanTextOptions` has two fields. `formatTime` writes the time of a person's check; it defaults to the local hour and minute, so pass your own in a test. `others` lists other plans on the second line, after `Also in this chat:`.

The text is English and has no translation.
