# basmilius/adecore

The packages that agentic development environments share: Electron desktop apps in which a person works with agents. Every package releases under one version. The root `README.md` lists them; each package's `README.md` is for people who use it, this file for agents who work on it. Up to `0.13.x`, `ui` and `shell` were `@basmilius/desktop-ui` and `@basmilius/desktop-shell`.

## Who uses it

- Ruimte, `../ruimte` (`/Users/bas/Development/Projects/ruimte`, public). The UI is in `apps/client/src` and `packages/agents-react/src`, the shell in `apps/desktop/src` and `packages/desktop-bridge/src`. Its root `CLAUDE.md` holds its design rules.
- AfterMotion, `../aftermotion` (`/Users/bas/Development/Projects/aftermotion`, private). The UI is in `apps/client/src`, the shell in `apps/desktop/src` and `packages/desktop-bridge/src`.
- Solvidi Command Center, `../../Axilium/Solvidi/command-center` (`/Users/bas/Development/Axilium/Solvidi/command-center`, private, `solvidi/command-center`). The UI is in `apps/client/src`, the shell in `apps/desktop/src` and `packages/desktop-bridge/src`. Its issues carry the `Command Center` label.

Each depends on the npm release and swaps in this checkout with `bun link` (run in the package's folder) during a change. They read `src` through the `source` export condition, so none needs a build.

An issue from an app has three sections: `## Problem` (what is missing or wrong, with call sites and workaround), `## Wish` (the need, not a fix) and `## Impact on <the other apps>`. Treat the impact section as a starting point and read the call sites in every app yourself before you choose an API. An issue that lacks a section gets a comment asking for it before work starts.

## Changing the public API

- Before you change anything an entry point exports (a name, a prop, a default, a class a component puts on its element), read its call sites in every app: `grep -rn "<Name\b" ../ruimte/apps/client/src ../ruimte/packages/agents-react/src ../aftermotion/apps/client/src ../../Axilium/Solvidi/command-center/apps/client/src` for `ui`, and `grep -rn "\bname\b" ../ruimte/apps/desktop/src ../ruimte/packages/desktop-bridge/src ../aftermotion/apps/desktop/src ../aftermotion/packages/desktop-bridge/src ../../Axilium/Solvidi/command-center/apps/desktop/src ../../Axilium/Solvidi/command-center/packages/desktop-bridge/src` for `shell`.
- A request from one app gets a shape that describes the need, not the app. The answer may be a different API than the one asked for, or a no. An option for one app only exists when a third app could want it too; otherwise it stays in that app.
- A breaking change lists the call sites in every app, carries a migration note in the PR, and gets the `Breaking` label.
- Library code, `README.md` and any docs never name the apps. Describe the need ("a panel along the right edge", "a dialog opened over another"). Only this file and the issue templates may name them.
- `packages/ui/src/__snapshots__/exports.test.ts.snap` lists every exported name, types included, and the parts of every compound component. A change there is an API change: accept it with `bun test --update-snapshots` only when you meant it. A module or name not in the snapshot is internal.

## Layout

Bun workspaces: a package per folder in `packages/`, each published from its folder with the `files` whitelist of its `package.json`, and the docs site in `docs`. The root holds the shared config (`tsconfig.base.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `.editorconfig`) and the scripts over every package. Paths below are relative to `packages/ui` unless they start with `docs`.

- `src/index.ts` is the barrel: explicit named exports only, no `export *` except the `export * as` of a compound component. `src/settings`, `src/format`, `src/testing` and the preload `src/testing/dedupe.ts` are the other entry points.
- `src/theme.css` holds the tokens, the type scale and the rules utilities cannot write (`.icon-btn`, `.field`, `.menu-popup`, ...).
- Compound components (`src/menu`, `src/context-menu`, `src/dialog`, `src/popover`, `src/preview-card`) keep their parts under full names in `parts.tsx` (`MenuItem`) and map them onto the namespace in `index.parts.ts` (`Menu.Item`). A context menu reuses every part of a menu except its root and trigger.
- `src/locales/en.ts` and `nl.ts` hold the `ui` namespace. English is the source and Dutch has every key (`locales.test.ts`). Words are `.ts` modules in every package, never JSON: Node needs an import attribute on JSON that a browser refuses from a linked checkout.
- `scripts/build.ts` runs `tsc` into `dist` (one `.js` and `.d.ts` per file) and copies the theme. `tsc` keeps the JSX so `compileReactDist` (root `scripts/react-compiler.ts`) can run the React Compiler over it; `terminal`, `charts`, `agents-react` and `editor-react` build the same way.
- `docs` is the VitePress site at `https://adecore.dev`, a Cloudflare Worker (`wrangler.toml`) deployed by `release.yml`, or from main by `docs.yml`. It resolves every package to `src` (`.vitepress/library-source.ts`). Each package has a folder (`docs/ui`) and a sidebar in `.vitepress/navigation.ts`. `<Demo src="group/name" />` mounts `docs/demos/group/name.tsx` and prints its source; `docs/demos/shared` holds what demos import.
- `docs/docs.test.ts` fails when an exported name or a compound part appears on no page, or when a page names an app. `docs/demos.test.tsx` renders every demo. Both run in `bun run test`, so a new export comes with its docs in the same change.

## shell

- `src/index.ts` is the main process (`@adecore/shell`), `src/bridge/index.ts` the shapes that cross IPC (`/bridge`). The bridge never imports Electron, so a preload and a page read it too (`boundary.test.ts`).
- The package registers no IPC handler and listens to no app-wide Electron event. It follows only the windows and the app it is handed (`windows.ts` with `attach(app)`). The app wires each channel behind its own sender check; a package that listened by itself would bypass that check.
- Electron and electron-updater are optional peers, imported as types only. Every decision is a pure function or a factory with its clock, timer and updater injected, so the tests run in Bun.
- The IPC channel names the package sends on (`menu:run`) are API: every app's preload listens on them.

## database

- Three layers: views and client for the page (`.`), the host for the app's backend (`/host`, Bun or Node), and the Rust helper in `helper/` (binary `adecore-database`, rusqlite and mysql_async) that the host spawns. `/protocol` is the contract between them and imports nothing; `/testing` is an in-memory fake of it.
- The protocol lives in TypeScript (`src/protocol`) and is mirrored by hand in `helper/src/protocol.rs`. Both sides test against `fixtures/protocol/*.json`; a change to a message changes the fixtures, both sides and `PROTOCOL_VERSION`.
- Like `shell`, the host registers no channel: the app checks the sender and calls `handle(request, owner)`. Ruimte runs it in its Bun daemon, an Electron app without a daemon in a utility process.
- `bun run --cwd packages/database helper:check`, `helper:test` and `helper:build` run cargo. `bun run test:helper` joins page, host and helper outside the default suite; it skips locally without a compatible release build and fails in CI (`ADECORE_REQUIRE_DATABASE_HELPER=1`). The helper's MySQL tests need `ADECORE_TEST_MYSQL_URL`.

## terminal

- `TerminalView` is lifted out of Ruimte's `apps/client/src/terminal/xterm.ts`, `webgl-budget.ts` and `webgl-slots.ts`. Ruimte is the reference: a change keeps what its `TerminalBody`, `LaunchTerminal` and `LoginTerminal` do on top of it, or it is breaking.
- What one app needs (Ruimte's key bindings, OSC 52, its terminal registry) reaches xterm through `terminal` on the handle, never a prop.
- The fit and the pointer fix under a scaled ancestor read private xterm fields (`xterm-internals.ts`). Check them before widening the `@xterm/xterm` peer range.
- `terminal.css` holds the `--term-*` tokens and relies on `--accent`, `--selection` and `--font-mono` of the `ui` theme; the package imports nothing from `ui`.

## charts

- `Chart`, `Heatmap`, `Timeline`, `Sparkline` and `SeriesLegend` replace the charts the apps drew by hand: Ruimte's models charts and `ProcessChart`, Observatory's `TimeChart`, `RunChart`, `Heatmap` and `Waterfall`, and Command Center's `BarChart`. A change keeps what those would draw on top of it, or lists the difference in its PR.
- Scales and ticks come from `d3-scale` and `d3-shape`; the package draws its own SVG on theme tokens. The palette `--chart-1` to `--chart-6` lives in the `ui` theme.
- Deliberate differences from the apps' charts, decided by Bas: a measured y axis, labels thinned rather than truncated, value labels inside the chart, 1px between stacked segments, one tab stop with `aria-activedescendant`, and a first Escape that only clears the cursor.

## Scripts and commits

- `bun run check` (typecheck and oxlint, a warning fails), `bun run test`, `bun run build`, `bun run format` (oxfmt).
- `bun run test:perf` runs the `*.perf.test.ts` wall-clock gates, outside `test` and CI. Run it after a change to the editor or the language mirror.
- Work happens on `main`. Every commit passes check, test and build, plus `bun run --cwd docs build` when the docs changed: an app that links this checkout breaks with it.
- An issue closes through its commit: `Closes #<n>` in the body, with a line on why this API and not the one proposed. Commit freely; push and release only when Bas asks.
- Never `git stash`, `reset`, `restore` or `clean`, and never rewrite a commit: other agents may work in this checkout at the same time.
- Never start a dev or preview server; Bas runs the docs site himself.

## Releases

- A published release is immutable, so it starts as a draft: `gh release create v<version> --draft [--prerelease] --notes-file <notes>`, then `gh workflow run release.yml -f version=<version>`. A version already on npm is skipped, so a failed run can run again while the release is a draft.
- A new package stays `private` until its first version is published by hand with a token and its trusted publisher (`basmilius/adecore`, `release.yml`) is set.
- While the version is `0.x`, a breaking change bumps the minor and everything else the patch.
- An app takes a release only when its own repository bumps the version. Don't comment the version on closed issues unless Bas asks.

## React Compiler

- The React Compiler runs over every component and hook of `ui`, `terminal`, `charts`, `agents-react` and `editor-react`, in the build and in `bun run test` (`scripts/test-preload.ts`), so a test sees what `dist` ships. An app that reads `src` compiles it itself (`docs/guide`).
- No hand-written `useMemo`, `useCallback` or `memo` where the compiler covers it. Keep one where an effect lists the value (the lint asks for it), for a store or holder that must not be made twice, in a function the compiler leaves out, and `memo` on a component an uncompiled parent draws (the thread rows under `Timeline`).
- What a render reads must be an input of it: props, state, context or a `useSyncExternalStore` snapshot. An object that changes in place draws its old value once compiled; give it a snapshot getter (`RowHost.getContainers`). Where that is not small, start the function with `'use no memo'` and a comment why.
- Call the hooks a chat host hands in through `agents-react/src/host-hooks.ts` only; the compiler leaves out a component that calls them directly.
- The build prints how many functions the compiler left as written. `bun run lint` checks the Rules of React with the compiler's own rules (`.oxlintrc.json`).

## Design rules

`bun run lint` checks these in UI and database sources (`scripts/check-design-conventions.ts`, rules in `scripts/design-conventions.ts`):

- Type in the sizes of the theme's scale, never a size in brackets, nothing below 12px.
- A hint is a `Tooltip`, never a `title`.
- Icons are 12, 14, 16 or 20px. An icon button draws the icon of its size (`icon-button-size.ts`) and never sets its own height, width or radius.
- A button with a word in it is a `Button`.
- Only `src/format` builds an `Intl` formatter.
- Colors are tokens of the theme: no hex, `rgb()` or `hsl()` in a component, and none in `theme.css` outside the two token blocks.
- Whole pixels: no fractional `px`, and every `rem` or `em` in the theme inside `round(…, 1px)`.
- Keyboard focus is the accent outline, never a ring. Labels are sentence case, never `uppercase`.
- A key listener on the window only where the list in the test says why.

No check catches these:

- The theme stays neutral: the app sets its own accent.
- A border is an alpha over what is behind it. Every surface clips its background to the padding box (the base layer does that).
- Every component takes `className` and `ref` (React 19, no `forwardRef`). A part that is one element takes Base UI's `render` prop through `useRender`.
- Props follow Base UI: `value`/`onValueChange`, `checked`/`onCheckedChange`, `open`/`onOpenChange`. Variants and sizes are props, never class strings the caller passes. Nothing exports a class string.
- A component's utilities and a caller's never set the same property: Tailwind does not order two utilities by their place in `class`. A caller that needs another value gets a prop.
- No module does work at import time (`sideEffects` lists only the CSS and the test preload). A DOM write goes in an effect; a costly value is built on first use.
- A component reads its words through `useTranslation('ui')`, never the global `i18next`.
- Every number, date and duration a person reads comes from `src/format`.

## Conventions

- TypeScript, React 19, Bun. 4 spaces, LF; `.editorconfig` is the rule.
- American English in code, comments, docs and UI text. Never an em dash or an en dash anywhere.
- Always curly braces, also for a one-line early return. No one-letter names except `i`, `e`, `x`, `y`.
- Arrow functions inside functions; a class method is never an arrow property. Named components are `function` declarations.
- Comments say why, never what the code already says. Keep the comment density of the file you are in.
- Conventional commits in English (`feat:`, `fix:`, `build:`, `ci:`, `docs:`, `test:`, `refactor:`). No attribution lines.

## What lives here and what stays in the apps

Adecore owns the reusable parts: agent contracts, hosts and views, merge, drawing, diagram and plan cores, the service managers, the shared tree in `ui` and `database`, and the editor family (`editor-core`, `editor`, `lsp`, `editor-react`). The extracted packages keep their current limits and open feature work.

The apps keep their catalogs and actions, full wire contracts, IPC channels and sender checks, CSP, account and auth behavior, view and canvas navigation, daemon defaults and branding. A rename keeps persisted records and wire shapes. Nothing here imports an app alias, `@ruimte/*` or a sibling app checkout.

Every package is FSL-1.1-MIT and keeps its own `LICENSE`. Keep third-party licenses and provenance; `editor-core` keeps its Apache notice.

When agents work in parallel, each keeps to its own package, its config and its docs pages. Root config, installs, `bun.lock`, release and CI scripts, docs navigation and source resolution belong to whoever does the build integration.

## Build, pack and publish

- `scripts/workspaces.ts` reads the package graph. Builds include internal dev dependencies; publication follows runtime, optional and peer dependencies, skips private packages and refuses a public package that depends on a private one.
- `release:version <version>` pins internal dependencies to the exact version and peers to its caret range. Only release automation runs it.
- On a clean checkout, build before check: compiled exports need the dependencies' declarations.
- `bun run test` leaves out provider integration tests. `scripts/test-preload.ts` loads the English UI and chat namespaces, after the UI dedupe preload.
- `bun run test:pack` packs every workspace, validates its export targets and runs Node and Bun consumers outside this checkout, without publishing. CI packs once (`bun run pack <dir>`) and validates the tarballs on Node 24 (`bun run test:pack --artifacts <dir>`). Release validation sets `ADECORE_REQUIRE_NATIVE_BINARIES=1` after downloading the native artifacts.
- A model's minimum CLI version (`minCliVersion`, such as `2.1.4`) lives in `packages/agents/src/providers/<kind>-models.json`. The address book serves those files, so a new minimum reaches machines without an app release. A model gets one only once its minimum is known.

## Moving the apps over

Each app switches in its own repository. Ruimte replaces its agent package names and feature imports, scans the agent CSS in Tailwind, sets the persistence namespace so drafts and preferences survive, composes the Adecore schemas without changing its wire protocol, and keeps its CLI environment filtering and desktop permission checks. AfterMotion first aligns its older UI, shell and agent behavior. Command Center supplies its tree and host adapters. Check the packed exports and the linked `source` exports in each app. Remove nothing from Ruimte until it has switched completely and the migration is validated; green package checks do not authorize cleanup.

Ruimte's service adapter keeps its daemon spec, `RUIMTE_HOME`/`RUIMTE_SERVICE`, executable copying and npx cache policy, and hands `@adecore/service` the `description`, launchd `label`/`logFile`, systemd `unitName`, uid/home/configHome/user and runtime adapters. Executable ownership checks, install authorization and linger prompts stay in the app.

These legacy spellings stay as they are: `ChatSubagentItemSchema.origin` keeps `'ruimte'`, `RUIMTE_SESSION_VARIABLES` and the `RUIMTE_HOOK_`/`RUIMTE_CONTEXT_` prefix filters stop inherited session callbacks, and `LEGACY_MENTION_DRAG_TYPE` keeps `application/x-ruimte-mention` until producer and receiver migrate together. The docs describe them generically and link their definitions.

## Editor and language tooling

The editor family came from Ruimte at revision `9729144f0df3f25628f20cc283dee54f8d9e8162`. `editor-core` owns documents and history, `editor` the DOM engine and keymaps, `lsp` transports and language-service contracts, `editor-react` feature coordination and React displays. Hosts keep files, drafts, save permissions, routing, server process and install policy, AI orchestration and Git. The docs list the current accessibility, bidi, language and performance limits.

The PHP language server lives in `basmilius/language-server-php` (`/Users/bas/Development/Projects/language-server-php`), with its own releases and no npm package. `lsp` and `editor-react` stay generic; nothing here imports it.
