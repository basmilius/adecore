# WebGL

`webgl` draws with WebGL instead of the DOM, which is faster on a busy screen. The prop asks for a context; the page decides whether the terminal gets one.

## The budget

Browsers cap the WebGL contexts of a page, and a page that asks for too many loses the oldest. So at most ten terminals hold one at a time: the focused one first, then the most recently written. The others draw with the DOM and look the same.

A terminal that loses its context asks again on its next `focus()`. `webglTerminals()` lists the terminals that hold one, highest ranked first, for a debug panel or a test.

## Loading the addon early

The WebGL addon loads on the first grant, so the first terminal draws with the DOM for a moment. To load it earlier, register its import with the [prefetcher](/ui/utilities/lazy-loading) of `@adecore/ui`:

```ts
prefetcher.register(() => import('@xterm/addon-webgl'));
```
