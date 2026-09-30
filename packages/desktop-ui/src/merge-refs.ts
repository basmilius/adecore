import type { Ref, RefCallback } from 'react';

/* One callback ref that fills a component's own ref and the one its caller handed in. */
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
