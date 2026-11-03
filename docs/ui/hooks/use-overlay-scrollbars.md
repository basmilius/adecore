# useOverlayScrollbars

The bars of a [`ScrollArea`](/ui/layout/scroll-area) for a scroller you cannot wrap, such as the one an editor or a list library creates.

```tsx
import { useOverlayScrollbars } from '@adecore/ui';
```

Hand it the element that scrolls and render what it returns in a positioned element whose box is the scroller's. The bars lie along that element's right and bottom edges:

```tsx
const [scroller, setScroller] = useState<HTMLElement | null>(null);
const scrollbars = useOverlayScrollbars(scroller, { axis: 'both' });

useLayoutEffect(() => {
    const editor = mountEditor(host.current);
    setScroller(editor.scrollElement);

    return () => {
        setScroller(null);
        editor.dispose();
    };
}, []);

return (
    <div className="relative h-full">
        <div ref={host} className="absolute inset-0" />
        {scrollbars}
    </div>
);
```

The scroller keeps scrolling natively. The hook hides its own bar while it is attached and gives it back on `null`. It follows the scroller's size and its content's with a `ResizeObserver`.

`axis` is `'y'`, `'x'` or `'both'`, and `'y'` by default. `OverlayScrollbarsOptions` is an exported type.
