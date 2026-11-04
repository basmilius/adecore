# Paths

```ts
import { climbsOut, isBelow, isWithin } from '@adecore/utils/path';
```

Checks whether one path lies inside another, for Node and Bun. Use them before an app serves or writes a file it was asked for by name.

## The checks

- `isWithin(folder, path)` is true for the folder itself and everything below it.
- `isBelow(folder, path)` is true only below it, the folder itself not counted.
- `climbsOut(rel)` reads a path that `path.relative` returned. `..`, a path through `..` and an absolute path leave the folder, while a name such as `..cache` does not.

## Links and real paths

The checks compare text after `path.relative` normalized it, with the platform's separator, drive letters and case rules. They read nothing from the disk, so a link inside the folder that points outside still counts as inside. Resolve the real path first:

```ts
import { realpath } from 'node:fs/promises';
import { isBelow } from '@adecore/utils/path';

export async function servable(root: string, file: string): Promise<boolean> {
    const [realRoot, realFile] = await Promise.all([realpath(root), realpath(file)]);

    return isBelow(realRoot, realFile);
}
```

Hold a handle on the file when another process could swap it between the check and the write. Which folders a caller may touch is up to the app.
