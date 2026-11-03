# ScrollArea

A box that scrolls under thin bars of its own. The bars float over the content and take no width. They are hidden at rest and show while the box scrolls or the pointer is over it.

```tsx
import { ScrollArea } from '@adecore/ui';
```

<Demo src="layout/scroll-area" />

The element that scrolls is a native scroller with its own bar hidden. Wheel, keyboard, `scrollIntoView`, focus and a virtualizer work on it as on any scrolling element.

`className` sizes the outer box, which holds the bars: give it a height, a `max-h-*` or a place in a flex column. Padding and the layout of the content go in `viewportClassName`. Every other prop lands on the viewport, so `role`, `tabIndex`, `onScroll` and `aria-*` belong to the element that scrolls.

`render` swaps the viewport for another element, for a list or a `<pre>` that has to be the element that scrolls:

```tsx
<ScrollArea render={<ul />} aria-label="Files" className="max-h-60" viewportClassName="p-1">
    {files.map((file) => (
        <li key={file}>{file}</li>
    ))}
</ScrollArea>
```

## The bars

A bar is a 6 pixel pill, 8 pixels with a faint track while the pointer is on it or drags it. Its hit area is 12 pixels wide along the edge, 20 pixels on a touch screen. Dragging the thumb scrolls along with it, and a press on the track pages toward the pointer. Where both bars show, each stops short of the corner. A bar whose direction has nothing to scroll stays hidden.

The colors are the `--scrollbar-thumb`, `--scrollbar-thumb-hover`, `--scrollbar-thumb-active` and `--scrollbar-track` tokens of the theme. A scroller that cannot be wrapped, such as one an editor or a list library creates, gets the same bars from [`useOverlayScrollbars`](/ui/hooks/use-overlay-scrollbars).

## A virtualized list

`viewportRef` hands over the element that scrolls:

```tsx
const viewport = useRef<HTMLElement>(null);

const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewport.current,
    estimateSize: () => 28
});

return (
    <ScrollArea viewportRef={viewport} className="h-full">
        <div style={{ height: virtualizer.getTotalSize() }}>…</div>
    </ScrollArea>
);
```

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `axis` | `ScrollAreaAxis` | `'y'` | `'y' \| 'x' \| 'both'`. The other direction clips. |
| `className` | `string` | | On the outer box. |
| `ref` | `Ref<HTMLDivElement>` | | The outer box. |
| `viewportClassName` | `string` | | On the viewport. |
| `viewportRef` | `Ref<HTMLElement>` | | The viewport, the element that scrolls. |
| `render` | `ReactElement \| function` | | Replaces the viewport element. |
| `children` | `ReactNode` | | |

`ScrollAreaProps` and `ScrollAreaAxis` are exported types.
