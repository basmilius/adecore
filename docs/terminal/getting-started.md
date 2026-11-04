# Getting started

## Install

xterm and its addons are peer dependencies, so the app picks their version:

```sh
bun add @adecore/terminal @xterm/xterm @xterm/addon-fit @xterm/addon-web-links @xterm/addon-webgl
```

React 19 is a peer as well. The WebGL addon loads only once a terminal asks for it; see [WebGL](/terminal/webgl).

## Load the styles

Import xterm's stylesheet and the package's own after the [theme](/ui/guide/theme) of `@adecore/ui`:

```css
@import "tailwindcss";
@import "@adecore/ui/theme.css";
@import "@xterm/xterm/css/xterm.css";
@import "@adecore/terminal/terminal.css";
```

The terminal reads its colors from the tokens of the theme, so without `theme.css` it draws in xterm's defaults.

## A first terminal

The view has no size of its own. Give it one with `className`, and hold the handle in a ref:

```tsx
import { TerminalView, type TerminalViewHandle } from '@adecore/terminal';
import { useEffect, useRef } from 'react';

export function OutputPane({ text }: { text: string }) {
    const view = useRef<TerminalViewHandle>(null);

    useEffect(() => {
        view.current?.write(text);
    }, [text]);

    return <TerminalView ref={view} label="Build output" readOnly convertEol className="h-64" />;
}
```

`readOnly` ignores typing, and `convertEol` treats a lone line feed as a line break, which captured output needs and a pty does not.

## Connect a process

A shell needs three wires: output to the view, typing to the process and the grid size to the process. The `session` below stands for whatever the app's backend exposes over its own IPC:

```tsx
export function ShellPane({ session }: { session: ShellSession }) {
    const view = useRef<TerminalViewHandle>(null);

    useEffect(() => session.onOutput((data) => view.current?.write(data)), [session]);

    useEffect(() => {
        const size = view.current?.size();

        if (size !== undefined) {
            session.start(size.cols, size.rows);
        }
    }, [session]);

    return (
        <TerminalView
            ref={view}
            label="Shell"
            onData={(data) => session.write(data)}
            onResize={(cols, rows) => session.resize(cols, rows)}
            className="h-full"
        />
    );
}
```

`size()` returns the grid fitted at mount, which the program starts with. After that, `onResize` reports every change. [Input and output](/terminal/input-output) explains the details, such as a host that has no room yet at mount.

## Checklist

- The page imports `theme.css`, xterm's CSS and `terminal.css`, in that order.
- The view has a height from `className` or from a flex parent.
- `label` names the terminal for a screen reader.
- The backend hears every `onResize`, or full-screen programs draw at the wrong width.
