# Avatar

A person in a circle: their initials on a neutral ground, or their picture.

```tsx
import { Avatar } from '@adecore/ui';
```

<Demo src="display/avatar" />

The initials are the first letters of the first two words that start with a capital, so "Sanne de Vries" gives SV. A name without a capital gives its first letter. With `src` the picture covers the initials once it has loaded; while it loads, or when it fails, the initials stay.

An avatar reads as the name. Beside the name it repeats, such as in the header of a message, pass `aria-hidden`.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `name` | `string` | | Required. |
| `src` | `string` | | A picture of the person. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 24, 36 and 48 pixels. |

It takes `className`, `ref` and the props of a `<span>`. `AvatarProps` is an exported type.
