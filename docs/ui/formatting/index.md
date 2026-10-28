# Format source

`@adecore/ui/format` writes every number, date, time and duration a person reads. It is the only place in the library that builds an `Intl` formatter. Your app can use it too.

```ts
import { formatNumber, formatDayClock, setFormatSource } from '@adecore/ui/format';
```

<Demo src="formatting/source" />

## Words and notation

Two separate settings shape a value. The language writes the words: the month, the weekday, "3 min ago". The region writes the notation: day and month order, separators, a 12 or 24 hour clock. An English interface on a Dutch computer reads `19 Sep, 08:05`.

## The source

The formatters read both settings through a `FormatSource` your app hands over once, before the first render. Pass it to `UIProvider` as `formatSource`, or call `setFormatSource` yourself.

```ts
interface FormatSource {
    language(): string;
    region(): string;
    systemLocale?(): string | undefined;
    subscribe(onChange: () => void): () => void;
}
```

`language` returns the interface language, such as `en` or `nl`. `region` returns a tag such as `nl-NL`, `FORMAT_LANGUAGE` for the language's own region, or `FORMAT_SYSTEM` for the operating system's; see [Regions](/ui/formatting/regions). `systemLocale` is for a desktop shell that can read the system region; a browser leaves it out. `subscribe` calls back when either setting may have changed.

Without a source the formatters write English, in the system's region when it is English and in `en-US` otherwise. `setFormatSource` returns the source it replaced, so a test can restore it.

## Drawing again on a change

A formatter is a plain function, so a component that calls one does not rerender on a change by itself. Call `useFormatLocale()` in it: it subscribes to the source and returns the current locale.

```tsx
function LastSaved({ at }: { at: number }) {
    useFormatLocale();
    return <span>{formatMoment(at)}</span>;
}
```

`formatLocale()` returns the resolved notation locale, such as `en-US`, and works outside React too.

## Sorting labels

`labelCollator()` returns an `Intl.Collator` for the interface language, to sort labels a person reads.

```ts
names.sort(labelCollator().compare);
```

It ignores case and accents and compares numbers as numbers, so `Tab 2` comes before `Tab 10`.

## Sorting proper names

`nameCollator(options)` returns an `Intl.Collator` in the runtime's own locale, for proper names such as model or vendor names. The interface language does not affect it. Pass a stable options object to reuse the collator.

```ts
const modelOrder: Intl.CollatorOptions = { sensitivity: 'base', numeric: true };
models.sort(nameCollator(modelOrder).compare);
```

## Fallbacks

`systemLocale()` returns the operating system's locale: the source's valid `systemLocale`, then the browser's first language, then `en-US`. A test that must not depend on the machine sets a region explicitly, as the [fake source](/ui/utilities/testing) does.

`FormatSource` is an exported type.
