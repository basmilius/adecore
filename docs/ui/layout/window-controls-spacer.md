# WindowControlsSpacer

Room at the start of a header for the window's own controls, such as the traffic lights of a macOS window with a hidden title bar. In fullscreen, where macOS hides them, the room goes away.

```tsx
import { setWindowControlsSource, useWindowControlsInset, WindowControlsSpacer } from '@adecore/ui';
```

<Demo src="layout/window-controls-spacer" />

Put the spacer first in the header of whatever stands at the left edge: a sidebar, or the [`WorkspaceTopRow`](/ui/layout/workspace) while the sidebar is hidden.

```tsx
<WorkspaceTopRow leading={!sidebarOpen && <WindowControlsSpacer />}>...</WorkspaceTopRow>
```

`useWindowControlsInset()` returns the same width, or `undefined` where there are no controls to clear, for a layout that pads instead of placing a box.

## The source

The width comes from a source the app sets once, before the first render. Without one there is no room to keep, as in a browser tab. In a desktop app the shell knows the width; [`windowControls` and `followWindowControls`](/shell/theme#room-for-the-window-controls) report it with every change. Until the shell answers, `windowControlsOf` gives the room from the platform alone, so the first frame does not move.

```ts
import { type WindowControlsState, windowControlsOf } from '@adecore/shell/bridge';

let inset = windowControlsOf(desktop.platform).inset;
const listeners = new Set<() => void>();

const take = (state: WindowControlsState) => {
    inset = state.inset;
    listeners.forEach((listener) => listener());
};

desktop.onWindowControls(take);
void desktop.windowControls().then(take);

setWindowControlsSource({
    inset: () => inset,
    subscribe: (onChange) => {
        listeners.add(onChange);

        return () => listeners.delete(onChange);
    }
});
```

`setWindowControlsSource` returns the source it replaced, so a test can put that one back.

## Props

`WindowControlsSpacer` takes `className` and `ref`. `WindowControlsSpacerProps` and `WindowControlsSource` are exported types.
