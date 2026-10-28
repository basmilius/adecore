# Dates and times

Clocks, days and moments, each in the region's order and clock with the words of the language.

```ts
import { formatAge, formatClock, formatDay, formatDayClock, formatMoment } from '@adecore/ui/format';
```

<Demo src="formatting/dates" />

Every function takes a `Date` or epoch milliseconds; multiply epoch seconds by 1000 first. The examples are English words in a Dutch region; in `en-US` the same day reads `Sep 19 at 08:05 AM`.

| Function | Writes |
| --- | --- |
| `formatClock(at)` | The time: `08:05`, or `08:05 AM` on a 12 hour clock. |
| `formatHour(at)` | An hour, for a chart axis: `08`, or `8 AM`. |
| `formatWeekday(at, width?)` | The weekday: `Sat`, or `Saturday` with `'long'`. |
| `formatWeekdayClock(at)` | Weekday and time: `Sat 08:05`. |
| `formatDay(at)` | A short date: `19 Sep`. |
| `formatDayWithYear(at)` | The same with the year. |
| `formatWeekdayDay(at)` | `Sat 19 Sep`. |
| `formatDayClock(at)` | Date and time: `19 Sep, 08:05`. |
| `formatDayClockWithYear(at)` | The same with the year: `19 Sep 2026, 08:05`. |
| `formatNumericDate(at)` | All numbers: `19-9-2026` or `9/19/2026`. |
| `formatMoment(at, now?)` | The time when `at` is today, otherwise date and time. |
| `formatAge(at, now?)` | A row's age: `3d ago` for the first week, then `19 Sep`, then `19 Sep 2025` in another year. A future `at` reads `now`. |
| `formatDateTime(at, options)` | Any `Intl.DateTimeFormatOptions`, with the language's words in the region's layout. |
| `isSameDay(a, b)` | Whether two instants fall on the same day in the reader's time zone. |

`formatClock`, `formatDay`, `formatDayWithYear`, `formatDayClock` and `formatDayClockWithYear` take a time zone as second argument. Pass `'UTC'` for a wall-clock value such as `2026-03-29T02:30`, so it reads `02:30` in every zone.

## How the words get in

`formatDateTime` takes the layout and numbers from the region, and the month, weekday, day period and era names from the language.

Use it for a format the others do not cover. Define its options object once, outside the component: the formatter is cached on that object.
