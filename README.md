# basmilius/desktop

Packages for desktop apps built on Electron, React 19 and Tailwind 4. They are released together, so every package carries the same version.

| Package | What it holds |
|---|---|
| [`@basmilius/desktop-ui`](packages/desktop-ui) | React components, a theme, formatters and a settings dialog. Documentation at [react-ui.bas.dev](https://react-ui.bas.dev). |

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
