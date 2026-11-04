# Records

```ts
import { isRecord } from '@adecore/utils/record';
```

`isRecord(value)` is true for any object that is not an array, and false for `null`, arrays and primitives. It narrows the value to `Record<string, unknown>`, so its fields can be read and checked one by one.

Use it on input from the wire or a file before you read its fields:

```ts
function readPort(json: unknown): number | null {
    if (!isRecord(json) || typeof json.port !== 'number') {
        return null;
    }

    return json.port;
}
```

A `Date`, a `Map` or a class instance passes too. The guard says only that fields can be read, not that the value came from JSON. For a full shape, parse with a schema instead.
