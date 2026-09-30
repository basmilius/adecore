# Field

A labeled control with an optional hint and error under it, stacked 6 pixels apart. `FieldHint` and `FormError` are the same two lines on their own, for a control that is not inside a `Field`.

```tsx
import { Field, FieldHint, FormError } from '@basmilius/desktop-ui';
```

<Demo src="inputs/field" />

Type `main` into the branch name to see the error. An [`Input`](/inputs/input) or a `TextArea` inside a `Field` connects itself. The label points at it with `htmlFor`, `aria-describedby` names the hint and the error, and an error sets `aria-invalid`. Another control needs its own accessible name, since the `Field` cannot reach inside it.

## A group

A `<label>` can point at an input, not at a [`Segmented`](/inputs/segmented), a [`Select`](/inputs/select), [`ChoiceCards`](/inputs/choice-cards) or a path in a box with a button beside it. `group` draws the same label, hint and error with the same spacing, and makes the `Field` a `role="group"` its label names and its hint and error describe. The control inside still takes its own accessible name, and an `Input` inside a group is left unconnected, for an input that is one part of what the group holds.

```tsx
<Field group label="Folder" hint="The project is made in a new folder here.">
    <div className="flex items-center gap-2">
        <div className="field flex min-w-0 flex-1 items-center text-text-muted">{path}</div>
        <Button variant="secondary" onClick={choose}>Choose…</Button>
    </div>
</Field>
```

## Beside the control

In a dialog with a form of several fields, a stack of labels and controls soon scrolls. `orientation="horizontal"` puts the label in a column of 112 pixels beside the control, at the size of what is typed, so the controls of every field line up. The hint and the error stay under the control. The label sits on the middle of the control's first line, however tall a `TextArea` grows.

<Demo src="inputs/field-horizontal" />

## Field props

| Prop | Type | |
| --- | --- | --- |
| `children` | `ReactNode` | Required. The control. |
| `label` | `ReactNode` | Drawn as a [`SectionLabel`](/display/section-label) above the control. |
| `hint` | `ReactNode` | The line under the control that says what goes in it. |
| `error` | `ReactNode` | Shown under the control and marks it invalid. `null` or `''` shows nothing. |
| `group` | `boolean` | Labels a group rather than one control. Default `false`. |
| `orientation` | `'vertical' \| 'horizontal'` | `horizontal` puts the label beside the control. Default `vertical`. |
| `className` | `string` | |
| `ref` | `Ref<HTMLDivElement>` | |

## FieldHint and FormError

`FieldHint` is a `<p>` in the hint's style with a 4 pixel margin above it. `FormError` is a `<p>` with `role="alert"`, so a screen reader announces it when it appears; use it for what went wrong in a dialog or a form as a whole. Both take `className`, `ref` and `render`.

`FieldProps`, `FieldHintProps` and `FormErrorProps` are exported types.
