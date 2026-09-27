# ErrorBoundary

Keeps a render failure to the subtree it happened in. Without one, React unmounts the whole tree on an error, and whatever lives in it (an embedded page, a running terminal, a half-written form) goes down with it.

```tsx
import { ErrorBoundary } from '@basmilius/react-ui';
```

<Demo src="display/error-boundary" />

In place of the subtree it shows what failed, the error's message, a button to try again and a button that copies a report with the stack and the component stack. The failure is also logged to the console.

## Trying again

`resetKeys` lists what the children draw from. When one of them changes, the boundary draws its children again. It only compares keys while it holds an error, so a subtree that renders fine never remounts because its data changed. Try again resets it by hand.

Give every surface that draws data of its own a boundary. The outermost one has nothing around it to fall back to; give it `reload`, which adds a button that reloads the page.

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
