# FileIcon

The icon a file gets in a file tree, drawn anywhere else the same file's name shows up: a tab, a picker row, a search result. It is the one place the library steps outside Lucide.

```tsx
import { FILE_TREE_ICONS, FileIcon } from '@basmilius/desktop-ui';
```

<Demo src="display/file-icon" />

The glyphs are the complete set of [`@pierre/trees`](https://www.npmjs.com/package/@pierre/trees), and their colors are the set's own, through the `--file-icon-*` tokens of the [theme](/guide/theme#file-icons). A TypeScript blue or a Vue green is the mark of the file type, not a theme choice. Only the last segment of the path decides which icon it is. The sprite with every glyph goes into the document once, before the first icon paints.

## With a file tree

A `@pierre/trees` tree resolves and colors its own icons inside its shadow root. Hand it `FILE_TREE_ICONS` as its icon configuration, so the tree and every `FileIcon` beside it use the same set and never disagree about a file.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `path` | `string` | | Required. Absolute or relative. |
| `size` | `number` | `16` | |
| `className` | `string` | | |
| `ref` | `Ref<SVGSVGElement>` | | |

`FileIconProps` is an exported type.
