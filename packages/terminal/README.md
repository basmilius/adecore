# @adecore/terminal

[![npm](https://img.shields.io/npm/v/@adecore/terminal)](https://www.npmjs.com/package/@adecore/terminal)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev/terminal/)

A terminal pane on [xterm.js](https://xtermjs.org) that looks like the rest of an `@adecore/ui` interface in both themes. It fits the box it is given, opens links in the output and either takes typing or only shows output. The app feeds it output and reads back what is on screen through a handle, without touching xterm's addons.

**[Documentation](https://adecore.dev/terminal/)**

## Install

```sh
bun add @adecore/terminal @xterm/xterm @xterm/addon-fit @xterm/addon-web-links @xterm/addon-webgl
```

xterm and its addons are peer dependencies, so the app picks the version. Import xterm's stylesheet and this package's after the theme of `@adecore/ui`:

```css
@import "tailwindcss";
@import "@adecore/ui/theme.css";
@import "@xterm/xterm/css/xterm.css";
@import "@adecore/terminal/terminal.css";
```

## Use

```tsx
import { TerminalView, type TerminalViewHandle } from '@adecore/terminal';

const view = useRef<TerminalViewHandle>(null);

useEffect(() => session.onOutput((data) => view.current?.write(data)), [session]);

<TerminalView ref={view} label="Shell" onData={(data) => session.write(data)} onResize={(cols, rows) => session.resize(cols, rows)} className="h-full" />
```

## License

FSL-1.1-MIT, see [LICENSE](./LICENSE).
