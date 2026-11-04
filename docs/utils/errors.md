# Errors

```ts
import { asError, describeError, hasErrorCode, isNotFound } from '@adecore/utils/errors';
```

Helpers to read a thrown value. They use no platform API, so a page imports them as well as a process.

## Error codes

`hasErrorCode(e, ...codes)` checks the `code` that Node and Bun put on a system error. `isNotFound(e)` checks for `ENOENT`:

```ts
async function readOptional(path: string): Promise<string | null> {
    try {
        return await readFile(path, 'utf8');
    } catch (e) {
        if (isNotFound(e)) {
            return null;
        }

        throw e;
    }
}
```

## Log lines

`describeError(error, debug)` turns a thrown value into one line, its message, or into its stack with `debug` set. An empty message falls back to the error's name, and a value that is not an Error becomes its string.

A compiled Bun binary prints an Error object with a frame of minified source, so log the string instead of the object:

```ts
console.error(describeError(e, process.env.DEBUG === '1'));
```

## Rejecting with anything

`asError(thrown)` wraps anything that is not an Error, so a rejection always carries one.

## What stays out

A sentence for a person to read is a different thing from a log line. `@adecore/ui` keeps its own helper for that, see [error messages](/ui/utilities/error-messages). A host that wants stacks in its logs decides that in its own code.
