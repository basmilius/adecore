# Numbers

Counts, decimals, percentages, money, sizes and token counts, each in the notation of the region. The examples are in an English region; a Dutch one swaps the separators.

```ts
import { formatBytes, formatDecimal, formatMoney, formatNumber, formatNumeral, formatPercent, formatRounded, formatTokens, formatUsdSignificant } from '@adecore/ui/format';
```

<Demo src="formatting/numbers" />

| Function | Writes |
| --- | --- |
| `formatNumber(value)` | A rounded, grouped whole number: `1,234,568` or `1.234.568`. |
| `formatDecimal(value)` | The same with at most one decimal. |
| `formatRounded(value, decimals)` | At most `decimals` places, trailing zeros dropped: `39`, `1.95`. |
| `formatNumeral(numeral)` | A database numeral (number or text such as `9007199254740993` or `-0.50`) in the region's notation, keeping every digit and decimal. Other text comes back unchanged. |
| `formatPercent(value)` | A value that is already a percent: one decimal under ten, whole above. `4.3%`, `43%`. |
| `formatMoney(value, currency, maximumFractionDigits?)` | An amount with the narrow symbol: `$ 5.480,96` in a Dutch region, not `US$ 5.480,96`. `currency` is an ISO code such as `USD`. |
| `formatUsdSignificant(value)` | Dollars to three significant digits, for amounts from fractions of a cent to tens of dollars. |
| `formatTokens(value)` | A compact token count: `1.2M`, `412K`, `640`. |
| `formatBytes(bytes, whole?)` | A file size in B, KB, MB, GB or TB: `1.5 KB`, one decimal under ten. `whole` rounds. |

None of these converts. `formatMoney` never changes the currency, and `formatBytes` counts in steps of 1024.
