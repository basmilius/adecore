# Banner

The strip over a view: one line and the buttons that answer it. Anything that waits for a person goes here, such as a conflict, a failure or a request. A toast in the corner is read after the fact, and a decision has to be where the eyes already are.

```tsx
import { Banner } from '@basmilius/desktop-ui';
```

<Demo src="display/banner" />

By default it stands centered along the top of its positioned parent. Pass a `className` to put it somewhere else; it replaces the default placement. Show one at a time: the slot is one row, and the caller decides what stands in it. The banner is a polite live region, so a screen reader announces a new line.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `icon` | `LucideIcon` | | Required. |
| `tone` | `BannerTone` | | Required. `'attention' \| 'error' \| 'neutral'` colors the icon. |
| `message` | `ReactNode` | | Required. |
| `children` | `ReactNode` | | The buttons. |
| `className` | `string` | `'absolute inset-x-0 top-3 z-20'` | Where the strip stands. |
| `ref` | `Ref<HTMLDivElement>` | | |

`BannerProps` and `BannerTone` are exported types.
