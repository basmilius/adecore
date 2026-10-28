# Icon

One Lucide icon, sized in pixels, at the library's stroke width of 1.75.

```tsx
import { Icon } from '@adecore/ui';
import { Folder } from 'lucide-react';

<Icon icon={Folder} size={14} />;
```

<Demo src="display/icon" />

Icons come in 12, 14, 16 and 20 pixels. Use 16 on its own and in a 32 pixel button, 14 next to `text-sm` or in a menu row, 12 in the smallest controls, and 20 in an empty state.

An icon carries `aria-hidden`; the name belongs on the button or label next to it. It is centered on the text beside it.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `icon` | `LucideIcon` | | Required. |
| `size` | `number` | `16` | In pixels. |
| `className` | `string` | | |
| `ref` | `Ref<SVGSVGElement>` | | |

`IconProps` is an exported type.
