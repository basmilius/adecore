# Status

Summarize a result or show progress. Use one leading Summary; its children are inline prose, never headings or tables.

<Demo src="intelligent-ui/status" />

```ui
<Summary tone="warning" badge="1 failing">The release build passed, one smoke test failed</Summary>
<Callout tone="info" title="Retried once">The test failed again on a clean runner.</Callout>
<Progress value={312} max={500}>Tests run</Progress>
<Steps>
<Step state="done">Build</Step>
<Step state="failed" detail="login.spec.ts">Smoke tests</Step>
<Step state="pending">Publish</Step>
</Steps>
<Tag tone="danger">blocking</Tag>
```

Every `tone` is a `UiTone`: `neutral`, `info`, `success`, `warning` or `danger`. Tone expresses meaning; the agent never infers it from a number going up.

## Summary

The result in one sentence. Its children are the sentence. The first Summary heads the block and names it for a screen reader; a later one is a subheading.

| Prop    | Type     | Required | Notes                               |
| ------- | -------- | -------- | ----------------------------------- |
| `tone`  | `UiTone` | No       | Gives the sentence an icon          |
| `badge` | string   | No       | A short label beside it, as a pill  |

## Callout

A note that needs attention. Its children are the note.

| Prop    | Type     | Required | Notes                  |
| ------- | -------- | -------- | ---------------------- |
| `tone`  | `UiTone` | Yes      | The surface and icon   |
| `title` | string   | No       | A line above the note  |

## Tag

A short status label. Its children are the label. A Tag may stand inside text.

| Prop   | Type     | Required | Notes |
| ------ | -------- | -------- | ----- |
| `tone` | `UiTone` | No       |       |

## Progress

Progress with a label. Its children are the label. Without `value` the progress is indeterminate; without `max` the value reads as a percentage.

| Prop    | Type   | Required | Notes          |
| ------- | ------ | -------- | -------------- |
| `value` | number | No       | Zero or more   |
| `max`   | number | No       | Above zero     |

## Steps and Step

An ordered sequence. `Steps` has no props and holds only `Step`. A `Step` stands only inside `Steps`; its children are the step's label.

| Prop     | Type   | Required | Notes                                                  |
| -------- | ------ | -------- | ------------------------------------------------------ |
| `state`  | string | Yes      | `done`, `running`, `pending`, `failed` or `skipped`   |
| `detail` | string | No       | Faint text beside the label, such as a file or a time  |
