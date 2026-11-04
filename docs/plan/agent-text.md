# Text for an agent

`renderPlanText` writes the compact form an agent reads back, with the ids it needs for its next operations. The [Markdown demo](/plan/markdown) prints it next to the Markdown it came from.

```ts
import { renderPlanText } from '@adecore/plan';

const text = renderPlanText(plan);
```

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

## What a line holds

`renderPlanText(plan, options)` writes one line per item with its id in brackets, so the ids survive when a conversation is compacted.

- A step shows who may check it (`agent-only`, `person-only` or `unlocked`) and `set by a person` with the time.
- Parents and sections show how many of their steps are finished.
- Descriptions and notes are folded onto one line.

`PLAN_LEGEND` explains the markers in one line, and `PLAN_STATE_MARKERS` maps each state to its marker. Send the legend once, for example in the agent's instructions.

## Options

`PlanTextOptions` has two fields:

| Field        | Default                    |                                                                     |
| ------------ | -------------------------- | ------------------------------------------------------------------- |
| `formatTime` | The local hour and minute  | How the time of a person's check reads. Pass your own in a test.    |
| `others`     | None                       | Other plans, listed on the second line after `Also in this chat:`.  |

```ts
renderPlanText(plan, { formatTime: (at) => at.slice(11, 16) });
// [x] 2 Approve the release [approve] person-only, set by a person 09:10
```

The text is English and has no translation.
