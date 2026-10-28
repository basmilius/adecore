# Field

A labeled control with an optional hint and error under it. `FieldHint` and `FormError` are those two lines on their own, for a control outside a `Field`.

```tsx
import { Field, FieldHint, FormError } from '@adecore/ui';
```

<Demo src="inputs/field" />

Type `main` into the branch name to see the error. An [`Input`](/ui/inputs/input) or `TextArea` inside a `Field` connects itself: label, `aria-describedby` and `aria-invalid`. Any other control needs its own accessible name.

## A group

A `<label>` cannot point at a [`Segmented`](/ui/inputs/segmented), a [`Select`](/ui/inputs/select), [`ChoiceCards`](/ui/inputs/choice-cards) or a compound control. `group` draws the same label, hint and error, and makes the `Field` a `role="group"` named by its label. The control inside still needs its own accessible name, and an `Input` inside is not connected.

```tsx
<Field group label="Folder" hint="The project is made in a new folder here.">
    <div className="flex items-center gap-2">
        <div className="field flex min-w-0 flex-1 items-center text-text-muted">{path}</div>
        <Button variant="secondary" onClick={choose}>Choose…</Button>
    </div>
</Field>
```

## Beside the control

`orientation="horizontal"` puts the label in a 112 pixel column beside the control, so the controls of a dialog line up. Hint and error stay under the control. The label aligns with the control's first line.

<Demo src="inputs/field-horizontal" />

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `children` | `ReactNode` | | Required. The control. |
| `label` | `ReactNode` | | A [`SectionLabel`](/ui/display/section-label) above the control. |
| `hint` | `ReactNode` | | |
| `error` | `ReactNode` | | Marks the control invalid. `null` or `''` shows nothing. |
| `group` | `boolean` | `false` | |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

## FieldHint and FormError

`FieldHint` is a `<p>` in the hint's style. `FormError` is a `<p>` with `role="alert"`, for an error of a whole form or dialog. Both take `className`, `ref` and `render`.

`FieldProps`, `FieldHintProps` and `FormErrorProps` are exported types.
