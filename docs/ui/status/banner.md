# Banner

The strip over a view: one line and the buttons that answer it. Use it for anything that waits for a person, such as a conflict, a failure or a request. A toast is for what a person may read after the fact.

```tsx
import { Banner } from '@adecore/ui';
```

<Demo src="display/banner" />

By default it floats centered along the top of its positioned parent. Show one at a time. The banner is a polite live region, so a screen reader announces a new line.

## In the flow of a page

With `placement="inline"` the banner stands in the flow and fills its row without a shadow, such as a warning above a table. Its `className` adds margins and the like.

<Demo src="display/banner-inline" />

On the overlay, a `className` replaces the floating position.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `icon` | `LucideIcon` | | Required. |
| `tone` | `BannerTone` | | Required. `'attention' \| 'error' \| 'neutral'` colors the icon. |
| `message` | `ReactNode` | | Required. |
| `children` | `ReactNode` | | The buttons. |
| `placement` | `'overlay' \| 'inline'` | `'overlay'` | Floats over the view, or stands in the flow and fills its row. |
| `className` | `string` | | On the overlay, replaces its position. |
| `ref` | `Ref<HTMLDivElement>` | | |

`BannerProps` and `BannerTone` are exported types.
