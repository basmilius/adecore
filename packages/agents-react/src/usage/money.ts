import { useMemo } from 'react';
import { useUsage } from '../state/usage';
import { moneyFormat } from './format';

/* The formatter every amount on the page goes through: the chosen currency, at the rate the summary on screen carries. */
export function useMoney(): (usd: number) => string {
    const currency = useUsage((s) => s.currency);
    const rate = useUsage((s) => s.summary?.rate ?? null);
    return useMemo(() => moneyFormat(currency, rate), [currency, rate]);
}
