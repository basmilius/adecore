# FileIcon

The icon a file gets in a file tree, and anywhere else its name shows up: a tab, a picker row, a search result. It is the only icon outside Lucide.

```tsx
import { FILE_TREE_ICONS, FileIcon } from '@adecore/ui';
```

<Demo src="display/file-icon" />

The glyphs and colors are those of [Seti UI](https://github.com/jesseweed/seti-ui), through the `--file-icon-*` tokens of the [theme](/ui/guide/theme#file-icons). The last segment of the path picks the icon: by whole name (`package.json`), then a part of it (`Dockerfile.dev`), then the longest extension (`spec.ts` before `ts`). Anything else gets the generic file icon. The icon is hidden from screen readers.

## An icon of the app's own

`setFileIconOverride` lets an app draw some files with an icon of its own. The function gets each path and returns the address of an SVG for it, or `null` to keep the icon from this set. Pass `null` to remove it.

```tsx
setFileIconOverride((path) => (path.endsWith('.acme') ? '/icons/acme.svg' : null));
```

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
