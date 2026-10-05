# FileIcon

The icon a file gets in a file tree, drawn anywhere else the same file's name shows up: a tab, a picker row, a search result. It is the one place the library steps outside Lucide.

```tsx
import { FILE_TREE_ICONS, FileIcon } from '@adecore/ui';
```

<Demo src="display/file-icon" />

The glyphs are those of [Seti UI](https://github.com/jesseweed/seti-ui), and so are their colors, through the `--file-icon-*` tokens of the [theme](/ui/guide/theme#file-icons): a TypeScript blue or a Vue green is the mark of the file type, not a theme choice. Only the last segment of the path decides which icon it is, first by its whole name (`package.json`), then by a part of it (`Dockerfile.dev`), then by its longest extension (`spec.ts` before `ts`). Anything else gets the generic file icon. The sprite with every glyph goes into the document once, before the first icon paints. The icon is decorative and hidden from screen readers.

## With a file tree

A [`FileTree`](/ui/display/file-tree) resolves its own icons inside its shadow root, and `useFileTree` hands it `FILE_TREE_ICONS` already. Pass `FILE_TREE_ICONS` as the `icons` option yourself only when you build a `@pierre/trees` model without `useFileTree`, so the tree and every `FileIcon` beside it use the same set.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `path` | `string` | | Required. Absolute or relative. |
| `size` | `number` | `16` | In pixels. |
| `className` | `string` | | |
| `ref` | `Ref<SVGSVGElement>` | | |

`FileIconProps` is an exported type.
