import { useEffect, useState } from 'react';

/* True once `on` has held for `ms`, for a spinner that only shows when waiting takes long. */
export function useLater(on: boolean, ms: number): boolean {
    const [late, setLate] = useState(false);
    useEffect(() => {
        if (!on) {
            return;
        }
        const timer = setTimeout(() => setLate(true), ms);
        return () => {
            clearTimeout(timer);
            setLate(false);
        };
    }, [on, ms]);
    return on && late;
}
