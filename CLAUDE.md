# basmilius/desktop

The packages two desktop apps share, released together under one version. Today that is `@basmilius/desktop-ui` (`packages/desktop-ui`): components, a theme, formatters and a settings dialog, on React 19, Base UI, Lucide and Tailwind 4. It was `@basmilius/react-ui` up to `0.4.x`, in a repository of that name. Each package's `README.md` is for people who use it; this file is for agents who work on it. `packages/desktop-ui/MIGRATION.md` maps the names it replaced onto the current ones.

## Who uses it

Two apps, and later more:

- Ruimte, `../ruimte` (`/Users/bas/Development/Projects/ruimte`, public). The UI is in `apps/client/src` and `packages/agents-react/src`. Its root `CLAUDE.md` holds its design rules.
- AfterMotion, `../aftermotion` (`/Users/bas/Development/Projects/aftermotion`, private). The UI is in `apps/client/src`.

Both depend on the release on npm and swap in this checkout with `bun link` (run in the package's folder) while a change is in progress. They read `src` through the `source` export condition, so neither needs a build of it.

An issue from either app has three sections: `## Problem` (what is missing or wrong, with the app's call sites and its workaround), `## Wish` (the need, not a fix) and `## Impact on <the other app>` (the other app's call sites a change would touch). Take the impact section as a starting point, not as the answer: read the call sites in both apps yourself before you choose an API. An issue that lacks a section gets a comment asking for it before any work starts.

## Changing the public API

- Before you change anything an entry point exports (a name, a prop, a default, a class a component puts on its element), read its call sites in both apps: `grep -rn "<Name\b" ../ruimte/apps/client/src ../ruimte/packages/agents-react/src ../aftermotion/apps/client/src`.
- A request from one app gets a shape that describes the need, not the app. The answer may be a different API than the one asked for, or a no: something only one app needs stays in that app.
- No option exists for one app only unless its shape is generic enough that a third app could want it.
- A breaking change lists the call sites in both apps, carries a migration note (in the PR and, while it lasts, in `MIGRATION.md`), and gets the `Breaking` label.
- Library code, `README.md` and any docs never name the apps. Describe the need ("a panel along the right edge", "a dialog opened over another"). Only this file, the issue templates and `MIGRATION.md` may name them.
- `packages/desktop-ui/src/__snapshots__/exports.test.ts.snap` lists every exported name, types included, and the parts of every compound component. A change there is an API change: accept it with `bun test --update-snapshots` only when you meant it.

## Layout

Bun workspaces: every package in `packages/`, published from its own folder with the `files` whitelist in its `package.json`, and the docs site in `docs`. The root holds the shared config (`tsconfig.base.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `.editorconfig`) and the scripts that run over every package. Paths below are relative to `packages/desktop-ui` unless they start with `docs`.

- `src/index.ts`: the barrel, `@basmilius/desktop-ui`. Explicit named exports only, no `export *` except the `export * as` of a compound component.
- `src/settings/index.ts`, `src/format/index.ts`, `src/testing/index.ts`: the other entry points. `src/testing/dedupe.ts` is one too, a `bun test` preload that exports nothing.
- `src/theme.css`: the tokens, the type scale and the rules utilities cannot write (`.icon-btn`, `.field`, `.menu-popup`, `.menu-item`, `.dialog-popup`, `.tooltip-popup`, ...). Exported as `./theme.css`.
- `src/menu`, `src/context-menu`, `src/dialog`, `src/popover`, `src/preview-card`: the compound components. `parts.tsx` holds the parts under their full names (`MenuItem`), `index.parts.ts` maps them onto the namespace (`Menu.Item`). A context menu reuses every part of a menu except its root and trigger.
- `src/locales/en.json`, `nl.json`: the `ui` namespace. English is the source; Dutch has every key English has (`locales.test.ts`).
- Internal modules (not exported): `dialog-layer.ts`, `error-boundary.ts`, `file-icon.ts` except `FILE_TREE_ICONS`, `shortcut-hints.ts`, `wipe-split.ts`, `class-name.ts`, `merge-refs.ts`, `field-context.ts`, `icon-button-size.ts`, `icon-picker.ts` except the type `IconPickerGroup`, `zoom.ts` except `ZOOM_PRESETS`.
- `scripts/build.ts`: `tsc` into `dist`, one `.js` and one `.d.ts` per source file, then the theme copied.
- `docs`: the VitePress site at `https://react-ui.bas.dev`, deployed as a Cloudflare Worker with static assets (`wrangler.toml`) by `release.yml`, or from main by `docs.yml`. It resolves `@basmilius/desktop-ui` to `src` through the `source` condition of every entry point (`.vitepress/library-source.ts`), so the docs never wait for a build. A page shows a demo with `<Demo src="group/name" />`, which mounts `docs/demos/group/name.tsx` as a React island and prints the file under it; `docs/demos/shared` holds what demos import and is no demo. The theme page reads its tokens from `src/theme.css` at build time.
- `docs/docs.test.ts` fails when a name in the export snapshot or a part of a compound component is mentioned on no page; `docs/demos.test.tsx` renders every demo. Both run in `bun run test`, so a new export needs a line in the docs in the same change.

## Scripts

- `bun run check`: typecheck and oxlint; a warning fails.
- `bun run test`: `bun test`, tests next to the code.
- `bun run build`: `dist`.
- `bun run format`: oxfmt.

All three of check, test and build pass before a commit, and so does `bun run --cwd docs build` when the docs changed. CI (`.github/workflows/ci.yml`) runs them on every push to main and every PR. Never start a dev or preview server; Bas runs the docs site himself when a change needs a look.

## Working here

- Work happens on `main`, and every commit there passes check, test and build: an app that links this checkout breaks with it.
- An issue closes through its commit: `Closes #<n>` in the message body, with a line on why this API and not the one proposed. Commit freely; push and release only when Bas asks.
- Never `git stash`, `git reset`, `git restore` or `git clean`, and never rewrite a commit: other agents may work in this checkout at the same time.

## Releases

- Publishing a GitHub release (`gh release create v<version>`, or Bas's `/release` skill) runs `release.yml`: it sets the version from the tag in every package, checks, tests, builds, publishes every package that is not `private` with npm Trusted Publishing and deploys the docs. Every `package.json` stays at `0.0.0`. A version already on npm is skipped, so a failed run can run again.
- A new package gets its first version on npm by hand, with a token, before its trusted publisher (`basmilius/desktop`, `release.yml`) can be set; until then it stays `private`.
- While the version is `0.x`, a breaking change bumps the minor and everything else the patch.
- An app takes a release only when its own repository bumps the version. Neither happens from here: after a release, name the version on the issues it closed so the apps know what to take.

## Design rules

`packages/desktop-ui/src/conventions.test.ts` holds every file of that package to these:

- Type in the sizes of the theme's scale, never a size in brackets, nothing below 12px.
- A hint is a `Tooltip`, never a `title`.
- Icons are 12, 14, 16 or 20px. An icon button draws the icon of its size (`icon-button-size.ts`) and never sets its own height, width or radius.
- A button with a word in it is a `Button`.
- Only `src/format` builds an `Intl` formatter.
- Colors are tokens of the theme: no hex, `rgb()` or `hsl()` in a component, and none in `theme.css` outside the two token blocks.
- Whole pixels: no fractional `px`, and every `rem` or `em` in the theme inside `round(…, 1px)`.
- Keyboard focus is the accent outline, never a ring. Labels are sentence case, never `uppercase`.
- A key listener on the window only where the list in the test says why.

And these, which the tests do not catch:

- The theme stays neutral. The app sets its own accent; nothing here assumes one.
- A border is an alpha over what is behind it. Every surface clips its background to the padding box (the base layer does that for all).
- Every component takes `className` and `ref` (React 19, no `forwardRef`). A part that is one element takes Base UI's `render` prop through `useRender`.
- Props follow Base UI: `value`/`onValueChange`, `checked`/`onCheckedChange`, `open`/`onOpenChange`. Variants and sizes are props, never class strings the caller passes. Nothing exports a class string.
- A component's own utilities and a caller's must not set the same property: Tailwind does not decide between two utilities by their order in `class`. Where a caller needs another value, that is a prop.
- No module does work at import time (`sideEffects` lists only the CSS and the test preload). A DOM write goes in an effect; a costly value is built on first use.
- Words live in the `ui` namespace, in English and Dutch. A component reads them through `useTranslation('ui')`, never through the global `i18next`.
- Every number, date and duration a person reads comes from `src/format`.

## Conventions

- TypeScript, React 19, Bun. 4 spaces, LF; `.editorconfig` is the rule.
- American English in code, comments, docs and UI text. Never an em dash or an en dash anywhere.
- Always curly braces, also for a one-line early return. No one-letter names except `i`, `e`, `x`, `y`.
- Arrow functions inside functions; a class method is never an arrow property. Named components are `function` declarations.
- Comments say why, never what the code already says. Keep the comment density of the file you are in.
- Conventional commits in English (`feat:`, `fix:`, `build:`, `ci:`, `docs:`, `test:`, `refactor:`). No attribution lines.
