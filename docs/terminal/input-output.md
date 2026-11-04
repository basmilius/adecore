# Input and output

The app talks to the view through two channels. Props report what happens in the view, and the handle tells the view what to do.

## Writing output

`write(data, done?)` draws output. Writes keep their order, and `done` runs once the data is on screen. Escape sequences work as in any terminal, so colors, cursor moves and the alternate screen of a full-screen program need nothing extra.

```tsx
const view = useRef<TerminalViewHandle>(null);

useEffect(() => session.onOutput((data) => view.current?.write(data)), [session]);
```

The scrollback keeps 5000 lines.

## Replaying from the start

`reset()` clears the screen and the scrollback, in order with earlier writes. To replay a log, call `reset()` and then `write` the whole text:

```ts
view.current?.reset();
view.current?.write(log);
```

## Reading what the person types

`onData` reports what the person types or pastes, as the bytes a program expects. Pass it on unchanged. Option on a Mac sends Meta.

`paste(text)` pastes on the app's behalf, bracketed when the program asks for that, the same way a paste from the keyboard is. `selectAll()` and `selection()` serve a context menu; `selection()` is empty without a selection.

`focus()` and `blur()` move the keyboard. Focus also ranks the terminal first for a [WebGL context](/terminal/webgl).

## Reading the screen

`visibleText()` returns the rows on screen as plain text, without the blank space after the last character. Use it to hand a screen to an agent or to test what a program drew.

## Sizing

The view fits its grid to its container. `size()` returns the grid fitted at mount as a `TerminalSize`, `{ cols, rows }`, which a program starts with. After that, `onResize` reports every new grid, debounced during a drag, and after a font change too.

A host with no room yet at mount, such as a tab that is still hidden, keeps xterm's default of 80 by 24. Its first real fit arrives through `onResize`, so start the program from `size()` and resize it on every `onResize`.

## Several windows on one program

When two windows show the same program, the last one to resize sets its grid. The other window must draw that grid, clipped or padded, instead of fitting its own.

`followGrid(size)` does that. It draws the grid the program reports until the next local fit claims it back through `onResize`:

```ts
session.onGrid((size) => view.current?.followGrid(size));
```

## Showing output only

`readOnly` ignores typing and stops the cursor blinking. `convertEol` treats a lone line feed as a line break, for captured output that never went through a pty. Both can change while the view is mounted.
