# Testing

`@adecore/ui/testing` holds fakes for your app's own tests, and `@adecore/ui/testing/dedupe` a preload for `bun test` with a linked checkout. Nothing in either belongs in a bundle that ships.

```ts
import { fakeFormatSource } from '@adecore/ui/testing';
```

## fakeFormatSource

A [format source](/ui/formatting/) you set by hand. It starts in English, in the region of the language. Hand it to `setFormatSource` and set the region a test expects, so numbers and dates do not depend on the machine.

```ts
import { afterAll, afterEach, expect, test } from 'bun:test';
import { formatNumber, setFormatSource } from '@adecore/ui/format';
import { fakeFormatSource } from '@adecore/ui/testing';

const source = fakeFormatSource();
const previous = setFormatSource(source);

afterEach(() => {
    source.set({ language: 'en', region: 'language' });
});

afterAll(() => {
    setFormatSource(previous);
});

test('a count is grouped the way the region groups one', () => {
    source.set({ region: 'nl-NL' });
    expect(formatNumber(1234567)).toBe('1.234.567');
});
```

`set({ language?, region? })` changes either setting. It notifies no subscriber, so a drawn component keeps its text until it renders again. `setFormatSource` returns the source it replaced, and it is the only way the formatters get theirs: a component draws with the fake once you have handed it over.

`FakeFormatSource` is an exported type, a `FormatSource` with `set`.

## A linked checkout under bun test

An app that links a checkout of the library (see [Getting started](/ui/guide/getting-started#working-on-a-local-checkout)) loads the checkout's React, i18next and Base UI next to its own under `bun test`. The first hook then fails with "Invalid hook call". Bun has no `resolve.dedupe` like Vite, so the library ships a preload that does the same. Put it first in `bunfig.toml`:

```toml
[test]
preload = ["@adecore/ui/testing/dedupe", "./test-preload.ts"]
```

It swaps the checkout's copy of these packages for the app's:

- `react`, `react-dom`, `i18next`, `react-i18next` and `@base-ui/react`.
- What a package of the checkout names in the `adecore.dedupe` field of its own `package.json`. The agent views name `@codemirror/*` and `@lezer/*`, which reject extensions made by a second copy, and `shiki`, for a highlighter the app hands them. The editor names `shiki`.

It covers every package of the checkout's repository. It leaves alone a package the app has no copy of. With the library from the registry the preload does nothing.

A package of the library that takes a shared instance from the app lists it in its `package.json`. `@scope/*` stands for every package of a scope:

```json
{
    "adecore": {
        "dedupe": ["@codemirror/*", "shiki"]
    }
}
```

In a monorepo with an isolated install, a root bunfig may not resolve the package. Point at the file through the workspace instead:

```toml
[test]
preload = ["./apps/web/node_modules/@adecore/ui/src/testing/dedupe.ts"]
```

## Rendering in a test

The components render in any React test setup. Wrap them in `UIProvider` with an i18next instance, so they find their words:

```tsx
const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', resources: {} });

const markup = renderToStaticMarkup(
    <UIProvider i18n={i18n}>
        <Stepper label="Size" value={3} onValueChange={() => {}} min={1} max={5} step={1} />
    </UIProvider>
);
```
