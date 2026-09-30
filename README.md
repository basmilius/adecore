# basmilius/desktop

Packages for desktop apps built on Electron, React 19 and Tailwind 4. They are released together, so every package carries the same version.

| Package | What it holds |
|---|---|
| [`@basmilius/desktop-ui`](packages/desktop-ui) | React components, a theme, formatters and a settings dialog. Documentation at [desktop.bas.dev/desktop-ui](https://desktop.bas.dev/desktop-ui/). |
| [`@basmilius/desktop-shell`](packages/desktop-shell) | The main process of an Electron app: its menu, its updater and the guards around its page. Documentation at [desktop.bas.dev/desktop-shell](https://desktop.bas.dev/desktop-shell/). |

`@basmilius/desktop-ui` was published as `@basmilius/react-ui` up to `0.4.x`; [MIGRATION.md](packages/desktop-ui/MIGRATION.md) covers the switch.

## Development

```sh
bun install
bun run check    # typecheck and lint
bun run test
bun run build
```

## License

MIT
