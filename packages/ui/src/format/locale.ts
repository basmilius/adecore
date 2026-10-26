import { useSyncExternalStore } from 'react';
import { FORMAT_LANGUAGE, FORMAT_SYSTEM } from './regions.ts';

/* The app hands it over once, before the first render; the language writes the words and the region writes the notation. */
export interface FormatSource {
    language(): string;
    /* A region tag such as `nl-NL`, or `FORMAT_LANGUAGE` or `FORMAT_SYSTEM`. */
    region(): string;
    /* The system's own locale when a shell can read it; a browser tab falls back on `navigator`. */
    systemLocale?(): string | undefined;
    subscribe(onChange: () => void): () => void;
}

let source: FormatSource = { language: () => 'en', region: () => FORMAT_LANGUAGE, subscribe: () => () => {} };

/* Answers the source it replaced, so a test can put that one back. */
export const setFormatSource = (next: FormatSource): FormatSource => {
    const previous = source;
    source = next;
    return previous;
};

/* The country most of a language's speakers are in. */
const LANGUAGE_REGIONS: Record<string, string> = { en: 'en-US', nl: 'nl-NL' };

/* So a format never depends on which machine ran the test. */
export const FALLBACK_LOCALE = 'en-US';

/* A month and a weekday are words, so they come from the language; the order, the separators and the clock come from the region. */
export const wordLocale = (): string => source.language();

/* macOS hands out locales with overrides attached, and a formatter built on one `Intl` does not know throws. */
const usable = (tag: string | undefined): string | null => {
    if (tag === undefined || tag === '') {
        return null;
    }
    try {
        return Intl.DateTimeFormat.supportedLocalesOf([tag]).length > 0 ? tag : null;
    } catch {
        return null;
    }
};

/*
 * In a desktop shell Chromium's locale is the language of the app bundle, so an English bundle on a
 * Dutch Mac would write `08:00 AM`; the shell passes the system's region in instead (`systemLocale`).
 */
export const systemLocale = (): string => {
    const fromShell = usable(source.systemLocale?.());
    if (fromShell !== null) {
        return fromShell;
    }
    if (typeof navigator === 'undefined') {
        return FALLBACK_LOCALE;
    }
    return usable(navigator.languages?.[0] ?? navigator.language) ?? FALLBACK_LOCALE;
};

/* The system's own region when it already speaks the language, so Dutch in Belgium keeps writing dates the Belgian way. */
const regionOfLanguage = (): string => {
    const language = source.language();
    const system = systemLocale();
    return system.toLowerCase().startsWith(language) ? system : (LANGUAGE_REGIONS[language] ?? language);
};

const resolve = (region: string): string => {
    if (region === FORMAT_LANGUAGE) {
        return regionOfLanguage();
    }
    return region === FORMAT_SYSTEM ? systemLocale() : region;
};

/* Read outside React as well, so it is a plain function rather than a hook. */
export const formatLocale = (): string => resolve(source.region());

const subscribe = (onChange: () => void): (() => void) => source.subscribe(onChange);

/* Subscribing is the point: a component draws again once the region changes. */
export const useFormatLocale = (): string => useSyncExternalStore(subscribe, formatLocale, formatLocale);

interface Cached<T> {
    locale: string | undefined;
    formatter: T;
}

/* A module-level options object shares its formatter across rows; a changed locale replaces it. */
const cacheFor = <O extends object, T>(
    store: WeakMap<O, Cached<T>>,
    options: O,
    locale: string | undefined,
    build: (locale: string | undefined, options: O) => T
): T => {
    const hit = store.get(options);
    if (hit !== undefined && hit.locale === locale) {
        return hit.formatter;
    }
    const formatter = build(locale, options);
    store.set(options, { locale, formatter });
    return formatter;
};

const numbers = new WeakMap<Intl.NumberFormatOptions, Cached<Intl.NumberFormat>>();
const dates = new WeakMap<Intl.DateTimeFormatOptions, Cached<Intl.DateTimeFormat>>();
const words = new WeakMap<Intl.DateTimeFormatOptions, Cached<Intl.DateTimeFormat>>();
const relatives = new WeakMap<Intl.RelativeTimeFormatOptions, Cached<Intl.RelativeTimeFormat>>();
const names = new WeakMap<Intl.CollatorOptions, Cached<Intl.Collator>>();

export const numberFormatter = (options: Intl.NumberFormatOptions): Intl.NumberFormat =>
    cacheFor(numbers, options, formatLocale(), (locale, spec) => new Intl.NumberFormat(locale, spec));

export const dateFormatter = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
    cacheFor(dates, options, formatLocale(), (locale, spec) => new Intl.DateTimeFormat(locale, spec));

/* Never shown whole: only its month, weekday, era and day period are lifted out of it. */
export const wordFormatter = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
    cacheFor(words, options, wordLocale(), (locale, spec) => new Intl.DateTimeFormat(locale, spec));

/* `3 min. geleden` is words as much as a number, so the language writes it, the way it writes a month. */
export const relativeFormatter = (options: Intl.RelativeTimeFormatOptions): Intl.RelativeTimeFormat =>
    cacheFor(relatives, options, wordLocale(), (locale, spec) => new Intl.RelativeTimeFormat(locale, spec));

/* Proper names keep the runtime locale; a shared options object reuses its collator. */
export const nameCollator = (options: Intl.CollatorOptions): Intl.Collator =>
    cacheFor(names, options, undefined, (locale, spec) => new Intl.Collator(locale, spec));

const collators = new Map<string, Intl.Collator>();

/* Labels are words, so the language sorts them: Dutch puts Tekening after Terminal where English puts Drawing before it. */
export const labelCollator = (): Intl.Collator => {
    const locale = wordLocale();
    let collator = collators.get(locale);
    if (collator === undefined) {
        collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
        collators.set(locale, collator);
    }
    return collator;
};

let nameCollators: { loose: Intl.Collator; exact: Intl.Collator } | null = null;

/* For names that are no words, such as files: what `localeCompare` did, without a collator built on every call. */
export const nameOrder = (left: string, right: string): number => {
    nameCollators ??= { loose: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }), exact: new Intl.Collator() };
    return nameCollators.loose.compare(left, right) || nameCollators.exact.compare(left, right);
};
