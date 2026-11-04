# Utils

`@adecore/utils` holds small helpers that several packages and apps wrote for themselves: waiting and deadlines, reading thrown values, atomic file writes and path checks. The package has no dependencies.

```sh
bun add @adecore/utils
```

## Entry points

Every entry point is a subpath, and there is no root import. A page never loads a module that needs Node by accident, because the Node-only helpers live behind their own subpath.

| Entry point | Runs in | What it holds |
| --- | --- | --- |
| [`@adecore/utils/async`](/utils/async) | a page or Node | waits, deadlines, timers and the order of async work |
| [`@adecore/utils/errors`](/utils/errors) | a page or Node | reading a thrown value |
| [`@adecore/utils/record`](/utils/record) | a page or Node | the guard for an object that is not an array |
| [`@adecore/utils/text`](/utils/text) | a page or Node | the halves of a UTF-16 surrogate pair |
| [`@adecore/utils/fs`](/utils/fs) | Node or Bun | atomic writes and small file checks |
| [`@adecore/utils/path`](/utils/path) | Node or Bun | whether a path lies inside a folder |

## Which helper for which job

| You want to | Use |
| --- | --- |
| Give up on a promise after a while | [`withTimeout`](/utils/async#deadlines) |
| Run writes to one file one after another | [`Serializer`](/utils/async#one-at-a-time) |
| Load the same thing once when many callers ask at the same time | [`SingleFlight`](/utils/async#once-per-key) |
| Ignore a file that does not exist | [`isNotFound`](/utils/errors) |
| Log an error as one line | [`describeError`](/utils/errors) |
| Save a file so a crash never leaves half of it | [`writeAtomic`](/utils/fs#atomic-writes) |
| Refuse a path outside a folder | [`isBelow`](/utils/path) |

The full list of names is in the [reference](/utils/reference).

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/utils/LICENSE).
