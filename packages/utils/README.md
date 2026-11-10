# @adecore/utils

Small helpers without dependencies: atomic file writes, path containment, the order of async work, reading a thrown value and the math on points and boxes. Each lives at its own subpath. `async`, `errors`, `geometry`, `record` and `text` run in a page; `fs` and `path` need Node or Bun.

```sh
bun add @adecore/utils
```

Licensed under FSL-1.1-MIT, see [LICENSE](./LICENSE).

```ts
import { writeAtomic } from '@adecore/utils/fs';
import { isBelow } from '@adecore/utils/path';

if (isBelow(folder, target)) {
    await writeAtomic(target, JSON.stringify(state), 0o600, { durable: true });
}
```

`isBelow` compares text and reads nothing from the disk. Resolve real paths first when a link could lead out of the folder.

Read the [overview](https://adecore.dev/utils/).
