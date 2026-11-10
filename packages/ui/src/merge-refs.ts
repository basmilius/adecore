import type { Ref, RefCallback } from 'react';

export const mergeRefs =
    <T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> =>
    (node) => {
        for (const ref of refs) {
            if (typeof ref === 'function') {
                ref(node);
            } else if (ref) {
                ref.current = node;
            }
        }
    };
