# Performance

Run `bun --conditions=source scripts/benchmark-ui.ts` from the repository root. It streams about 100 deltas, ten milliseconds apart, through a fixture backend and a temporary chat store, and reports compiler timing, delta handling, timer delay, UI bytes, log bytes and replay timing.

Measured on macOS arm64 with Bun 1.4.2, 9 October 2026, as medians of twenty samples with a warm filesystem cache. Timer delay includes ordinary chat processing and disk writes.

| Input | Median scan |
| --- | ---: |
| 2,000,000 UTF-16 units of prose | 1.68 ms |
| The same prose followed by one UI block | 1.69 ms |
| 100,000 UI fences, 4,100,000 UTF-16 units | 0.07 ms |

| Streamed fixture | 100 stats in one block | 2,000,000 units of prose and one block |
| --- | ---: | ---: |
| Input bytes | 3,557 | 2,000,041 |
| UI previews sent | 5 | 1 |
| UI previews stored in the log | 0 | 0 |
| Final UI metadata bytes | 24,105 | 607 |
| Total log bytes | 38,456 | 4,207,524 |
| Median synchronous delta time | 0.04 ms | 0.50 ms |
| Final delta time | 2.21 ms | 6.12 ms |
| Maximum timer delay | 4.16 ms | 8.15 ms |
| Median disk-backed replay time | 0.62 ms | 3.78 ms |

Log bytes include the text deltas, the final text and ordinary chat events. Previews go only to attached clients and never into the log. Not yet measured: simultaneous chats, cold replay and recorded provider sessions.
