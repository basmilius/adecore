# Terminal

`@adecore/terminal` is a terminal pane on [xterm.js](https://xtermjs.org) in the theme of `@adecore/ui`. It fits its box, opens links and takes typing or only shows output. The app owns the program behind it: it writes output and reads the screen through a handle.

<Demo src="terminal/terminal-view" />

## What it does

- Fits the grid to its container and reports every new grid, debounced during a drag.
- Follows the theme and the accent of the page, light and dark, without a prop.
- Opens web links and OSC 8 hyperlinks through one handler the app can replace.
- Draws with WebGL when asked, within a budget the page shares between all its terminals.
- Keeps clicks on the right cell under a scaled ancestor, such as a zooming canvas.

## What it leaves to the app

The package runs no program and opens no pty. The app starts the process, sends what the person types to it and writes its output to the view. Key bindings, clipboard escapes and a registry of open terminals go through the [xterm instance](/terminal/xterm) on the handle, so each app wires its own.

## Where to next

- [Getting started](/terminal/getting-started) installs the package and wires a first terminal to a process.
- [Input and output](/terminal/input-output) covers writing, resetting, sizing and several windows on one program.
- [Theme and font](/terminal/theme), [Links](/terminal/links) and [WebGL](/terminal/webgl) cover how it looks and behaves.
- [Going past the props](/terminal/xterm) shows how to reach xterm for what the props leave out.
- [Reference](/terminal/reference) lists every prop, every member of the handle and every export.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/terminal/LICENSE).
