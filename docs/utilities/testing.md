# Testing

`@basmilius/react-ui/testing` holds fakes for your app's own tests. Nothing in it belongs in a bundle that ships.

```ts
import { fakeFormatSource } from '@basmilius/react-ui/testing';
```

## fakeFormatSource

A [format source](/formatting/) you set by hand: English, the region of the language, and no system locale of a shell. Hand it to `setFormatSource`, and a test's numbers and dates no longer depend on the machine that runs it.

```ts
import { afterAll, afterEach, expect, test } from 'bun:test';
import { formatNumber, setFormatSource } from '@basmilius/react-ui/format';
import { fakeFormatSource } from '@basmilius/react-ui/testing';

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

`set({ language?, region? })` changes either setting. `setFormatSource` answers the source it replaced, which the file puts back when it is done. A component under test draws with the fake if you pass it to `UIProvider` as `formatSource`.

`FakeFormatSource` is an exported type, a `FormatSource` with `set`.

## Rendering in a test

The components render in any React test setup. Wrap them in `UIProvider` with an i18next instance, so they find their words:

```tsx
const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', resources: {} });

const markup = renderToStaticMarkup(
    <UIProvider i18n={i18n} formatSource={fakeFormatSource()}>
        <Stepper label="Size" value={3} onValueChange={() => {}} min={1} max={5} step={1} />
    </UIProvider>
);
```
