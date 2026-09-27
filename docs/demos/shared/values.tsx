import type { ReactNode } from 'react';

/* A two-column table of calls and what they write. */
export function Values({ rows }: { rows: [string, ReactNode][] }) {
    return (
        <table className="w-full text-xs">
            <tbody className="divide-y divide-border-soft">
                {rows.map(([call, result]) => (
                    <tr key={call}>
                        <td className="py-1.5 pr-6 font-mono text-code text-text-muted">{call}</td>
                        <td className="py-1.5 text-text tabular-nums">{result}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
