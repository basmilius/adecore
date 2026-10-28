# Inputs

Change local block state. Bind a control with `value={$name}`; see [state and inputs](/intelligent-ui/language/state).

<Demo src="intelligent-ui/inputs" />

```ui
$selected = ["links"]
$notify = false
$limit = 20
$scope = "failed"
$name = "Ada"
$kind = "bug"
<Checklist value={$selected}>
<Item value="links">Fix the link parser</Item>
<Item value="preload">Make the bridge method optional</Item>
</Checklist>
<Switch value={$notify}>Notify me when it lands</Switch>
<Slider value={$limit} min={10} max={100} step={10} unit="runs">Runs to compare</Slider>
<Segmented value={$scope}>
<Option value="failed">Failed</Option>
<Option value="all">All</Option>
</Segmented>
<TextField value={$name} maxLength={40} placeholder="Your name">Name</TextField>
<Select value={$kind}>
<Option value="bug">Bug</Option>
<Option value="idea">Idea</Option>
<Option value="question">Question</Option>
</Select>
<Button action={@Reset()}>Reset</Button>
```

A control is disabled until its tag closes, and when its `value` is not a bare reference to a declared variable.

## Checklist and Item

Select values in a list. `Checklist` holds only `Item`, and binds the list of checked values. An `Item` stands only inside `Checklist`; its children are the label and may hold a link.

| Prop    | Type            | Required | Notes                   |
| ------- | --------------- | -------- | ----------------------- |
| `value` | array of scalars | Yes     | At most 1,000; bindable |

| Item prop | Type   | Required | Notes                               |
| --------- | ------ | -------- | ----------------------------------- |
| `value`   | scalar | Yes      | A string, number, boolean or `null` |

## Switch

A local boolean. Its children are the label.

| Prop    | Type    | Required | Notes    |
| ------- | ------- | -------- | -------- |
| `value` | boolean | Yes      | Bindable |

## Slider

A local number in a range. Its children are the label.

| Prop    | Type   | Required | Notes                                  |
| ------- | ------ | -------- | -------------------------------------- |
| `value` | number | Yes      | Bindable; from `min` to `max`          |
| `min`   | number | Yes      | Below `max`                            |
| `max`   | number | Yes      |                                        |
| `step`  | number | No       | Above zero                             |
| `unit`  | string | No       | Written after the value                |

## Segmented and Option

Choose one value. `Segmented` holds only `Option`, and binds the chosen option's value. An `Option` stands inside `Segmented` or [`Select`](#select); its children are its label. Keep labels to a few words; longer ones make the agents-react renderer stack the options in a column.

| Prop    | Type   | Required | Notes    |
| ------- | ------ | -------- | -------- |
| `value` | scalar | Yes      | Bindable |

| Option prop | Type   | Required | Notes |
| ----------- | ------ | -------- | ----- |
| `value`     | scalar | Yes      |       |

## Select

A dropdown, for more or longer options than a `Segmented` holds. `Select` holds only [`Option`](#segmented-and-option) and binds the chosen option's value. A Choice refuses a value no option offers. Text beside the options is the label, drawn above the dropdown and used as its accessible name: `<Select value={$kind}>Kind of report<Option ...>`. Without one, the dropdown is only called `Options`.

| Prop    | Type   | Required | Notes    |
| ------- | ------ | -------- | -------- |
| `value` | scalar | Yes      | Bindable |

## TextField

A line of text, up to `maxLength` characters. Its children are the label. It does not submit; the text reaches the agent only through a Choice.

| Prop          | Type   | Required | Notes                                                              |
| ------------- | ------ | -------- | ------------------------------------------------------------------ |
| `value`       | string | Yes      | Bindable; at most `maxLength` characters, or the field fails       |
| `maxLength`   | number | No       | A whole number from 1 to 1,024; 256 without it                      |
| `placeholder` | string | No       | At most 128 characters; shown while the field is empty             |

A count (`7 of 8 characters`) appears once the field is 80% full. A default over the limit makes the `TextField` fail alone and draw as its label.

## Button

Runs one action on local state when pressed. Its children are the label, on one line; a label that does not fit is truncated and shown whole in a tooltip.

| Prop       | Type    | Required | Notes                                                     |
| ---------- | ------- | -------- | --------------------------------------------------------- |
| `action`   | action  | Yes      | `@Set($name, constant)`, `@Reset($name)` or `@Reset()`     |
| `disabled` | boolean | No       |                                                           |

`action` runs only when pressed; see the [rules for buttons](/intelligent-ui/language/state#buttons).

## Show

Shows its children while `when` is true. Show may stand inside any container, and its children follow that container's rule.

| Prop   | Type    | Required | Notes |
| ------ | ------- | -------- | ----- |
| `when` | boolean | Yes      |       |

```ui
$details = false
<Switch value={$details}>Show details</Switch>
<Show when={$details}><Callout tone="info">The cache missed on every cold start.</Callout></Show>
```

## Each

Repeats its children for every item. Each may stand inside any container, and its children follow that container's rule.

| Prop    | Type   | Required | Notes                                                     |
| ------- | ------ | -------- | --------------------------------------------------------- |
| `items` | array  | Yes      | At most 1,000                                             |
| `as`    | string | Yes      | The item's name, a letter or `_` then letters, digits, `_` |

```ui
$checks = ["lint", "types", "tests"]
$done = ["lint"]
<Checklist value={$done}>
<Each items={$checks} as="check"><Item value={check}>{check}</Item></Each>
</Checklist>
```
