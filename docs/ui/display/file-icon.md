# FileIcon

The icon a file gets in a file tree, for anywhere else the file's name shows up: a tab, a picker row, a search result. It is the only icon outside Lucide.

```tsx
import { FILE_TREE_ICONS, FileIcon } from '@adecore/ui';
```

<Demo src="display/file-icon" />

The glyphs and colors are those of [Seti UI](https://github.com/jesseweed/seti-ui), through the `--file-icon-*` tokens of the [theme](/ui/guide/theme#file-icons). The last segment of the path picks the icon: by whole name (`package.json`), then a part of it (`Dockerfile.dev`), then the longest extension (`spec.ts` before `ts`). Anything else gets the generic file icon. The icon is hidden from screen readers.

## With a file tree

`useFileTree` already hands a [`FileTree`](/ui/display/file-tree) `FILE_TREE_ICONS`. Pass it as the `icons` option yourself only for a `@pierre/trees` model built without `useFileTree`.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `path` | `string` | | Required. Absolute or relative. |
| `size` | `number` | `16` | In pixels. |
| `className` | `string` | | |
| `ref` | `Ref<SVGSVGElement>` | | |

`FileIconProps` is an exported type.
