# Format source

`@basmilius/desktop-ui/format` writes every number, date, time and duration a person reads. It is the only place in the library that builds an `Intl` formatter, and your app can use it the same way.

```ts
import { formatNumber, formatDayClock, setFormatSource } from '@basmilius/desktop-ui/format';
```

<Demo src="formatting/source" />

## Words and notation

Two settings decide what a value looks like, and they are separate on purpose. The language writes the words: the month, the weekday, "3 min ago". The region writes the notation: the order of day and month, the separators, and whether the clock counts to 12 or 24. An English interface on a Dutch computer is a real combination, and it reads `19 Sep, 08:05`.

Change the language and the region above and watch both halves move independently.

## The source

The formatters read both settings through a `FormatSource` your app hands over once, before the first render. `UIProvider` takes it as `formatSource`; without the provider, call `setFormatSource` yourself.

```ts
interface FormatSource {
    language(): string;
    region(): string;
    systemLocale?(): string | undefined;
    subscribe(onChange: () => void): () => void;
}
```

`language` answers the language the interface is written in, such as `en` or `nl`. `region` answers a region tag such as `nl-NL`, or `FORMAT_LANGUAGE` to use the region the language comes with, or `FORMAT_SYSTEM` to follow the operating system; see [Regions](/desktop-ui/formatting/regions). `systemLocale` is for a desktop shell that can read the operating system's own region; a browser leaves it out. `subscribe` calls back whenever either setting may have changed.

Without a source the formatters write English in the region of English. `setFormatSource` answers the source it replaced, so a test can put that one back.

## Drawing again on a change

A formatter is a plain function, so a component that calls one does not know the region changed. Call `useFormatLocale()` in it. It subscribes to the source and answers the current locale, which you may use or ignore. A component that calls it draws again when a person changes the language or the region.

```tsx
function LastSaved({ at }: { at: number }) {
    useFormatLocale();
    return <span>{formatMoment(at)}</span>;
}
```

`formatLocale()` answers the locale the notation is written in, resolved from the source, such as `en-US`. It is a plain function over the source, so code outside React can read it too.

## Sorting labels

`labelCollator()` answers an `Intl.Collator` for the language, which is how two labels a person reads are put in order. Labels are words, so the language sorts them. Dutch and English can put the same two words in a different order.

```ts
names.sort(labelCollator().compare);
```

It compares without regard to case or accents and reads numbers inside a label as numbers, so `Tab 2` comes before `Tab 10`.

## Fallbacks

`FALLBACK_LOCALE` is `en-US`, the one locale to fall back on, so a format never depends on which machine ran a test. `systemLocale()` answers the operating system's locale: the shell's when it hands one over and `Intl` accepts it, then the browser's first language, then `FALLBACK_LOCALE`.

## Cost

A formatter is built once per options object and locale, and kept. A list of a thousand rows builds nothing new. A region change throws the cached formatters away, since the locale is part of what was cached.

`FormatSource` is an exported type. [Testing](/desktop-ui/utilities/testing) has a fake source for tests.
