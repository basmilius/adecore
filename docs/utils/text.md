# Text

```ts
import { isHighSurrogate, isLowSurrogate } from '@adecore/utils/text';
```

A character outside the Basic Multilingual Plane, such as most emoji, takes two UTF-16 code units in a JavaScript string: a high surrogate and a low one. Cutting between them leaves a broken character.

`isHighSurrogate(code)` and `isLowSurrogate(code)` take a code unit from `charCodeAt`. Check them before you cut a string at an offset:

```ts
function truncate(text: string, length: number): string {
    if (text.length <= length) {
        return text;
    }

    const end = isHighSurrogate(text.charCodeAt(length - 1)) ? length - 1 : length;

    return text.slice(0, end);
}
```
