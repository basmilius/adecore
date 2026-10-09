# Compilation and replay measurements

Run `bun --conditions=source scripts/benchmark-ui.ts` from the repository root. It uses a temporary chat store and a fixture backend, streams about 100 deltas ten milliseconds apart, and removes the store afterward. The output includes compiler timing, synchronous delta handling, timer delay, UI bytes, log bytes and disk-backed replay timing.

The measurements below were taken on macOS arm64 with Bun 1.4.2 on 9 October 2026. Scans and replays each have twenty samples after warmup. Replay reads have a warm filesystem cache. Timer delay measures how late a ten-millisecond timer ran during the fixture session, including ordinary chat processing and disk writes. It does not isolate the compiler's contribution.

| Input | Median scan before | Median scan after |
| --- | ---: | ---: |
| 2,000,000 UTF-16 units of prose | 3.25 ms | 1.68 ms |
| The same prose followed by one UI block | 3.36 ms | 1.69 ms |
| 100,000 UI fences, 4,100,000 UTF-16 units | 19.82 ms | 0.07 ms |

The scanner now visits lines individually and stops when the reply quota refuses further UI. It keeps the same UTF-16 ranges, fence rules and bounded fallback. It does not allocate an array containing every line before enforcing the quota.

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

Total log bytes include the original text deltas and the authoritative final text, as well as ordinary chat events. Preview bytes are sent only to attached clients. The fixture checks a single chat; simultaneous chats, cold disk replay and recorded responses from actual Claude and Codex sessions still need acceptance measurements.
