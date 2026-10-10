import type { Ref } from 'react';

/* Hands a node to a ref of either kind, for an element that keeps a ref of its own beside the one it was given. */
export function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
    if (typeof ref === 'function') {
        ref(node);
    } else if (ref) {
        ref.current = node;
    }
}
