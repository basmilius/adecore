# FileIcon

The icon a file gets in a file tree, drawn anywhere else the same file's name shows up: a tab, a picker row, a search result. It is the one place the library steps outside Lucide.

```tsx
import { FILE_TREE_ICONS, FileIcon } from '@adecore/ui';
```

<Demo src="display/file-icon" />

The glyphs are those of [Seti UI](https://github.com/jesseweed/seti-ui), which knows some 150 file types, and their colors are Seti's own, through the `--file-icon-*` tokens of the [theme](/ui/guide/theme#file-icons). A TypeScript blue or a Vue green is the mark of the file type, not a theme choice. Only the last segment of the path decides which icon it is: its whole name first, then a part of it, then its longest extension. The sprite with every glyph goes into the document once, before the first icon paints.

## With a file tree

A `@pierre/trees` tree resolves its own icons inside its shadow root. Hand it `FILE_TREE_ICONS` as its icon configuration: the sprite goes into the tree with the rules that color it, so the tree and every `FileIcon` beside it use the same set and never disagree about a file.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `path` | `string` | | Required. Absolute or relative. |
| `size` | `number` | `16` | |
| `className` | `string` | | |
| `ref` | `Ref<SVGSVGElement>` | | |

`FileIconProps` is an exported type.
