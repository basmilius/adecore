# Markdown and reading text

## Markdown carries content, not identity

`planToMarkdown(plan)` writes a GFM-style task list ending in LF. `parsePlanMarkdown(markdown)` returns a draft or a `plan-invalid` refusal with a line number. It is a dedicated plan format, not a general Markdown parser.

| Syntax                              | Plan content                                  |
| ----------------------------------- | --------------------------------------------- |
| One initial `# Title`               | Metadata title                                |
| Prose before items                  | Summary                                       |
| `## Section`                        | Top-level section                             |
| Prose before a section's first item | Section description                           |
| `- [ ] Step`                        | Open leaf step                                |
| Indented steps                      | Sub-steps                                     |
| Indented prose below a step         | Step description                              |
| Indented `> note` below a step      | Step note                                     |
| `> **Title** description`           | Text block                                    |
| A top-level horizontal rule         | End the section and return to top-level items |

The writer uses four spaces per nested level. The reader counts tabs as four spaces and accepts `-`, `*` or `+` list markers. A list item without a checkbox is an open step. Unknown state markers, stray prose and unsupported headings are refused. CRLF and lone CR input normalize to LF.

`PLAN_STATE_MARKERS` and `PLAN_LEGEND` describe all supported markers:

| Marker | State                                   |
| ------ | --------------------------------------- |
| `[ ]`  | Open, represented by absent draft state |
| `[~]`  | Active                                  |
| `[x]`  | Done; uppercase `X` also parses         |
| `[!]`  | Failed                                  |
| `[-]`  | Skipped                                 |
| `[?]`  | Blocked                                 |
| `[w]`  | Warning; uppercase `W` also parses      |
| `[i]`  | Info; uppercase `I` also parses         |

The reader drops parent state markers because parents derive state. The writer escapes description lines that would otherwise be interpreted as headings, rules, lists or quotes, and escapes bold text-block titles. It does not promise lossless arbitrary Markdown syntax in every title; keep titles as plain single-line labels.

Ids, revisions, timestamps, attribution, check ownership, unlocks, kind and status do not survive Markdown export. Reimporting creates new identities and agent attribution for explicit leaf states. It is an interchange draft, not a backup format or an update operation against an existing plan.

## Validate imported drafts before creation

Markdown parsing alone does not enforce all field/depth/item limits. Pass the result through `createPlan`, which reparses the strict draft and validates the created tree. Supply metadata overrides when the format omits a needed kind or default check policy.

```ts
import { createPlan, parsePlanMarkdown, planToMarkdown } from '@adecore/plan';

const markdown = '# Delivery\n\n## Work\n\n- [x] Build\n    > Passed locally\n- [ ] Review\n';
const parsed = parsePlanMarkdown(markdown);
if (!parsed.ok) {
    throw new Error(parsed.message);
}
let sequence = 0;
const created = createPlan(parsed.draft, {
    id: 'delivery-copy',
    now: '2026-01-01T00:00:00.000Z',
    mintId: () => `item-${++sequence}`,
    meta: { kind: 'steps', checks: 'anyone' }
});
if (!created.ok) {
    throw new Error(created.message);
}
const exported = planToMarkdown(created.plan);
console.log(exported.includes('- [x] Build'));
console.log(exported.includes('    > Passed locally'));
```

Importing a checked state with effective person-only checks is refused by creation. Import that step as open and let a person check it through the normal operation path.

## Compact reading text

`renderPlanText(plan, options = {})` returns text with plan identity, revision, progress, item ids, step markers, notes and permission details. It keeps ids visible so a caller can target later operations. Section/step descriptions appear below their item; multiline descriptions and notes collapse into a single line in this output.

`progressText` varies by kind. A steps plan reports done leaves, with warning/info counted as done and named separately. A test plan reports finished runs, passed leaves and other outcomes. Failed/skipped outcomes count as finished runs; blocked does not.

`PlanTextOptions.formatTime` controls the display of person-attributed times. The default uses local hours/minutes and returns an empty string for invalid dates. Inject a stable formatter for tests or consistent backend output.

`others` accepts related plans and prints their titles/progress on the second line. The current text uses the legacy phrase `Also in this chat`, and the API has no wording override. Omit `others` or produce host-owned text if that wording does not fit the host's domain. This output is American English and has no i18n provider.

Reading text is also not a backup format. Persist validated JSON for full fidelity. A host can present compact text as an alternative view, but the core supplies no UI or accessibility verification.
