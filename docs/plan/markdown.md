# Markdown

A plan reads and writes as a Markdown task list, for a person to paste or an agent to write.

<Demo src="canvas/plan-markdown" />

The demo runs the Markdown on the left through `parsePlanMarkdown` and `createPlan`, and prints [`renderPlanText`](/plan/agent-text) on the right.

## The format

| Markdown                                | Plan                                                                |
| --------------------------------------- | ------------------------------------------------------------------- |
| `# Title`, once, before everything else | The title                                                           |
| Text before the first item              | The summary                                                         |
| `## Section`                            | A section                                                           |
| Text right under a section heading      | The section's description                                           |
| `- [ ] Step`                            | A step, with the [state marker](/plan/state#state) in the brackets  |
| A list item indented under a step       | A sub-step                                                          |
| Indented text under a step              | The step's description                                              |
| An indented `> note` under a step       | The step's note                                                     |
| `> **Title** text`                      | A text block                                                        |
| `---`                                   | Ends a section; what follows is at the top                          |

## Reading Markdown

```ts
import { createPlan, parsePlanMarkdown } from '@adecore/plan';

const parsed = parsePlanMarkdown(`# Ship the release

- [ ] Run the tests
- [ ] Approve the release
`);

const created = parsed.ok ? createPlan(parsed.draft, { id: 'release', now: new Date().toISOString() }) : parsed;
```

`parsePlanMarkdown(markdown)` returns `{ ok: true, draft }`, a [draft](/plan/drafts) for `createPlan`, or a `plan-invalid` refusal that names the line. It reads `-`, `*` and `+` items, and an item without a checkbox as an open step. It refuses an unknown marker, a `###` heading and text that belongs to nothing. It drops a marker on a parent step. `createPlan` checks the limits.

## Writing Markdown

`planToMarkdown(plan)` writes the same format, four spaces per level. A parent step gets the marker of its derived state. Text that would read as markup gets an escaping backslash.

```ts
import { planToMarkdown } from '@adecore/plan';

planToMarkdown(plan);
// # Ship the release
//
// - [x] Run the tests
// - [x] Approve the release
```

`stepToMarkdown(step, describe)` writes one step as plain GFM for a clipboard that is not read back. The box is checked for `done` only, any other state but `open` follows the title in parentheses as `describe(state)` words it, and the note is quoted below. Sub-steps and the description stay out.

```ts
import { stepToMarkdown } from '@adecore/plan';

stepToMarkdown(step, (state) => state);
// - [ ] Run the tests (failed)
//     > Two cases time out
```

## What Markdown leaves out

Markdown carries content, not identity. It leaves out ids, `rev`, `by` and `at`, checks, unlocks, the kind and the status. A plan read back is a new plan with new ids and every state recorded as the agent's. Store plans as JSON.
