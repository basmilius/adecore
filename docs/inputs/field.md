# Field

A labeled control with an optional hint and error under it, stacked 6 pixels apart. `FieldHint` and `FormError` are the same two lines on their own, for a control that is not inside a `Field`.

```tsx
import { Field, FieldHint, FormError } from '@basmilius/react-ui';
```

<Demo src="inputs/field" />

Type `main` into the branch name to see the error. An [`Input`](/inputs/input) or a `TextArea` inside a `Field` connects itself. The label points at it with `htmlFor`, `aria-describedby` names the hint and the error, and an error sets `aria-invalid`. Another control needs its own accessible name, since the `Field` cannot reach inside it.

## Field props

| Prop | Type | |
| --- | --- | --- |
| `children` | `ReactNode` | Required. The control. |
| `label` | `ReactNode` | Drawn as a [`SectionLabel`](/display/section-label) above the control. |
| `hint` | `ReactNode` | The line under the control that says what goes in it. |
| `error` | `ReactNode` | Shown under the control and marks it invalid. `null` or `''` shows nothing. |
| `className` | `string` | |
| `ref` | `Ref<HTMLDivElement>` | |

## FieldHint and FormError

`FieldHint` is a `<p>` in the hint's style with a 4 pixel margin above it. `FormError` is a `<p>` with `role="alert"`, so a screen reader announces it when it appears; use it for what went wrong in a dialog or a form as a whole. Both take `className`, `ref` and `render`.

`FieldProps`, `FieldHintProps` and `FormErrorProps` are exported types.
