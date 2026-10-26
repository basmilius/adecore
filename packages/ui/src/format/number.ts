import { numberFormatter } from './locale.ts';

const WHOLE: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };
const ONE_DECIMAL: Intl.NumberFormatOptions = { maximumFractionDigits: 1 };

/* A count as a region groups one: `1,234,567` there, `1.234.567` here. */
export const formatNumber = (value: number): string => numberFormatter(WHOLE).format(Math.round(value));

export const formatDecimal = (value: number): string => numberFormatter(ONE_DECIMAL).format(value);

/* One options object per key, so the formatter cached on it is built once (`numberFormatter`). */
const specCache = <Key>(build: (key: Key) => Intl.NumberFormatOptions): ((key: Key) => Intl.NumberFormatOptions) => {
    const specs = new Map<Key, Intl.NumberFormatOptions>();
    return (key) => {
        let spec = specs.get(key);
        if (spec === undefined) {
            spec = build(key);
            specs.set(key, spec);
        }
        return spec;
    };
};

const fixedSpec = specCache((decimals: number) => ({ minimumFractionDigits: decimals, maximumFractionDigits: decimals }));

const roundedSpec = specCache((decimals: number) => ({ maximumFractionDigits: decimals }));

/* Always `decimals` places, so values that follow each other keep one width: `1,0` and `1,5`, never `1` and `1,5`. */
export const formatFixed = (value: number, decimals: number): string => numberFormatter(fixedSpec(decimals)).format(value);

/* At most `decimals` places, trailing zeros dropped, for a figure whose fraction may or may not be there: `39`, `1,95`. */
export const formatRounded = (value: number, decimals: number): string => numberFormatter(roundedSpec(decimals)).format(value);

/* Intl takes at most this many fraction digits. */
const MAX_FRACTION_DIGITS = 100;

const NUMERAL = /^[+-]?\d+(?:\.(\d+))?$/;

/*
 * A numeral as a database writes it (`12900`, `-0.50`, `9007199254740993`) with every digit kept: a
 * decimal or a big integer arrives as text, and a float would round it. Anything else comes back as it is.
 */
export const formatNumeral = (numeral: string | number): string => {
    const text = typeof numeral === 'number' ? String(numeral) : numeral.trim();
    const match = NUMERAL.exec(text);
    if (match === null) {
        return text;
    }
    const decimals = Math.min(match[1]?.length ?? 0, MAX_FRACTION_DIGITS);
    // A string goes to Intl as it is, so it formats the exact decimal and not the nearest double.
    return numberFormatter(fixedSpec(decimals)).format(text as Intl.StringNumericLiteral);
};

/* Percent as Activity Monitor writes it: a decimal under ten, where the difference still shows. */
export const formatPercent = (value: number): string => `${value < 10 ? formatDecimal(value) : formatNumber(value)}%`;

/* Narrow, or a Dutch region writes a dollar amount as `US$ 5.480,96`. */
const moneySpec = specCache((key: `${string}|${number | ''}`) => {
    const [currency, digits] = key.split('|');
    const maximumFractionDigits = Number(digits);
    return { style: 'currency', currency, currencyDisplay: 'narrowSymbol', ...(maximumFractionDigits ? { maximumFractionDigits } : {}) };
});

/* An amount in the currency it is already in, as a bank statement would print it. */
export const formatMoney = (value: number, currency: string, maximumFractionDigits?: number): string =>
    numberFormatter(moneySpec(`${currency}|${maximumFractionDigits ?? ''}`)).format(value);

const SIGNIFICANT_MONEY: Intl.NumberFormatOptions = { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumSignificantDigits: 3 };

/* Dollars to three significant digits, for amounts that run from a fraction of a cent to tens of dollars in one list. */
export const formatUsdSignificant = (value: number): string => numberFormatter(SIGNIFICANT_MONEY).format(value);

/* `1.2M`, `412K`, `640`: a token count is read as a size, not counted. */
export const formatTokens = (value: number): string => {
    const rounded = Math.round(value);
    if (rounded >= 1_000_000) {
        return `${formatDecimal(rounded >= 10_000_000 ? Math.round(rounded / 1_000_000) : rounded / 1_000_000)}M`;
    }
    if (rounded >= 1_000) {
        return `${formatDecimal(rounded >= 10_000 ? Math.round(rounded / 1_000) : rounded / 1_000)}K`;
    }
    return formatNumber(rounded);
};

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/*
 * A size the way a person says it, with the number in the region's own notation: whole bytes up to
 * a kilobyte, one decimal above that. `whole` is for a column that only has room for a round number.
 */
export const formatBytes = (bytes: number, whole = false): string => {
    let value = Math.max(0, bytes);
    let unit = 0;
    while (value >= 1024 && unit < UNITS.length - 1) {
        value /= 1024;
        unit++;
    }
    const decimals = unit > 0 && !whole && value < 10;
    return `${decimals ? formatDecimal(value) : formatNumber(value)} ${UNITS[unit]}`;
};
