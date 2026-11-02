# ErrorBoundary

Keeps a render failure to the subtree it happened in. Without one, React unmounts the whole tree on an error.

```tsx
import { ErrorBoundary } from '@adecore/ui';
```

<Demo src="display/error-boundary" />

In place of the subtree it shows the error's message, a try again button and a button that copies a report with both stacks. It also logs the failure to the console.

## Trying again

`resetKeys` lists what the children draw from. When one changes while the boundary holds an error, it draws its children again. Try again resets it by hand.

Give every surface that draws data of its own a boundary. Give the outermost one `reload`, which adds a button that reloads the page.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `label` | `string` | | Required. The first line of the message, such as "This view failed to render". |
| `children` | `ReactNode` | | Required. |
| `resetKeys` | `ResetKeys` | | `readonly unknown[]`, compared with `Object.is`. |
| `compact` | `boolean` | `false` | For a small surface: no icon and less space. |
| `reload` | `boolean` | `false` | |
| `className` | `string` | `'absolute inset-0'` | The box of the message; by default it covers the positioned parent. |

`ErrorBoundaryProps` and `ResetKeys` are exported types.
