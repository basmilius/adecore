# Status

Summarize a result or show progress. Use one leading Summary; its children are inline prose, never headings or tables.

<Demo src="intelligent-ui/status" />

```ui
<Summary tone="warning" badge="1 failing" detail="Build 4812 on main">The release build passed, one smoke test failed</Summary>
<Callout tone="info" title="Retried once">The test failed again on a clean runner.</Callout>
<Callout tone="danger" title="Do not publish">The failing test covers sign in.</Callout>
<Progress value={312} max={500} tone="warning" detail="188 tests left">Tests run</Progress>
<Steps>
<Step state="done" detail="2 min">Build</Step>
<Step state="failed" detail="login.spec.ts">Smoke tests</Step>
<Step state="pending">Publish</Step>
</Steps>
<Tag tone="danger">blocking</Tag>
<Timeline>
<Event at="14:02" tone="warning" detail="p95 above 2 s">Alert fired</Event>
<Event at="14:09" tone="info">Rolled back the release</Event>
<Event at="2026-10-14T14:14:00+02:00" tone="success">Recovered</Event>
</Timeline>
```

Every `tone` is a `UiTone`: `neutral`, `info`, `success`, `warning` or `danger`. A tone states a meaning. Never infer one from a number going up.

## Summary

The result in one sentence, as its children. The first Summary heads the block and names it for a screen reader; later ones are subheadings.

| Prop     | Type     | Required | Notes                              |
| -------- | -------- | -------- | ---------------------------------- |
| `tone`   | `UiTone` | No       | Gives the sentence an icon         |
| `badge`  | string   | No       | A short label at the end, as a tag |
| `detail` | string   | No       | A line under the sentence          |

A `badge` of up to 24 characters is a tag at the end of the row, in the tone. A longer one stands under the sentence, since a tag does not wrap.

## Callout

A note that needs attention. Its children are the note.

| Prop    | Type     | Required | Notes                                    |
| ------- | -------- | -------- | ---------------------------------------- |
| `tone`  | `UiTone` | No       | The surface and icon; `info` without one |
| `title` | string   | No       | A line above the note                    |

A `warning` and a `danger` color the whole tile in their tone. The other tones keep the gray tile and color only the icon.

## Tag

A short status label. Its children are the label. A Tag may stand inside text.

| Prop   | Type     | Required | Notes |
| ------ | -------- | -------- | ----- |
| `tone` | `UiTone` | No       |       |

## Progress

Progress with a label. Its children are the label. Without `value` the progress is indeterminate; without `max` the value reads as a percentage.

| Prop     | Type     | Required | Notes                                           |
| -------- | -------- | -------- | ----------------------------------------------- |
| `value`  | number   | No       | Zero or more                                    |
| `max`    | number   | No       | Above zero                                      |
| `tone`   | `UiTone` | No       | Colors the reading and gives it the tone's icon |
| `detail` | string   | No       | A faint line under the bar                      |

The bar keeps the accent color whatever the tone. A screen reader hears the tone as a word after the reading.

For a value against a limit that is no work in progress, use a [Meter](/intelligent-ui/components/data#meter).

## Steps and Step

An ordered sequence. `Steps` has no props and holds only `Step`. A `Step` stands only inside `Steps`; its children are the step's label.

| Prop     | Type   | Required | Notes                                                                      |
| -------- | ------ | -------- | -------------------------------------------------------------------------- |
| `state`  | string | No       | `done`, `running`, `pending`, `failed` or `skipped`; `pending` without one |
| `detail` | string | No       | Faint text at the end of the row, such as a file or a time                 |

The steps share one tile. Each is a row with its state as an icon, on a line that runs down to the next step. A detail that does not fit beside the label moves under it. Only a `failed` step says its state in a word, under its label; a screen reader hears the state of every step. A `running` step spins while the block streams or reads live data, and is a still dot after that.

## Timeline and Event

Events in time order. `Timeline` has no props and holds only `Event`, at least one. An `Event` stands only inside `Timeline`; its children are the title.

| Prop     | Type     | Required | Notes                                                                  |
| -------- | -------- | -------- | ---------------------------------------------------------------------- |
| `at`     | string   | Yes      | `HH:MM[:SS]`, `YYYY-MM-DD` or an ISO date-time with an optional offset |
| `tone`   | `UiTone` | No       | The color of the dot; the tone is also spoken to a screen reader       |
| `detail` | string   | No       | Faint text under the title                                             |

The host formats the time for the reader's language and region, with the year when it is not the current one. Without an offset, a time, date or date-time reads as written in every time zone. A lone `HH:MM:SS` keeps its seconds; fractions are dropped. With an offset (`Z`, `+02:00`, from `-12:00` to `+14:00`), it is an instant shown in the reader's time zone. Other offsets are refused.

An `at` in no known format still draws as written, with an `unreadable_time` warning for the agent. Events draw in the order written, so the agent sorts them.

`time` is an alias of `at`: the compiler reads it as `at` with a `renamed_prop` warning, or refuses it with `refused_prop` when `at` is written too.

A screen reader hears each row's time, title, tone (unless neutral) and detail. A `Timeline` that draws no `Event`, also after `Each` or `Show`, fails as a whole and shows as text.

A host that draws an `Event` itself reads `at` with `parseUiEventTime(at)` from `@adecore/intelligent-ui/event-time`. It returns a `UiEventTime`, or `null` for unknown text, which the host shows as written. `kind` is `time`, `date` or `datetime`, and `date` is a `Date`. `seconds` is true when a lone time wrote seconds. When `written` is true there was no offset, and `date` holds the written parts in UTC: format it with `timeZone: 'UTC'` from `@adecore/ui/format`. When it is false, `date` is an instant for the reader's zone.
