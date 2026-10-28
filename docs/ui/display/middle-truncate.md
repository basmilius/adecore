# MiddleTruncate

A path or a branch name on one line, cut in the middle instead of at the end: the start says where it is, the end says which one it is. `packages/ui/src/…/Settings.tsx` instead of `packages/ui/src/settings/Sett…`.

```tsx
import { MiddleTruncate } from '@adecore/ui';
```

<Demo src="display/middle-truncate" />

It keeps as much of the start and end as fits around an ellipsis, and cuts again when its width changes.

```tsx
<div className="flex min-w-0 items-center gap-2">
    <FileIcon path={path} size={14} />
    <MiddleTruncate text={path} className="font-mono" />
</div>
```

In a flex row it shrinks like any `min-w-0` child and never grows past the text. Set face and color through `className`, and the width through its parent.

Copying, find in page and a screen reader all get the whole text. While the text is cut, a `Tooltip` shows it whole. Set `tooltip={false}` where the element around it already has one. Until it has measured, it truncates at the end.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `text` | `string` | | Required. |
| `tooltip` | `boolean` | `true` | The whole text in a tooltip while it is cut. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLSpanElement>` | | |

`MiddleTruncateProps` is an exported type.
