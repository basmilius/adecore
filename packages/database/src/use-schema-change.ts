import { useEffect } from 'react';
import { useDatabaseClient } from './client-context.ts';
import { useStableCallback } from './use-stable-callback.ts';

/* Calls `onChange` when the shape of this schema changed, or of its connection when the change names no schema. */
export function useSchemaChange(connectionId: string, schema: string, onChange: () => void): void {
    const client = useDatabaseClient();
    const notify = useStableCallback(onChange);

    useEffect(
        () =>
            client.onSchemaChange((change) => {
                if (change.connectionId === connectionId && (change.schema === undefined || change.schema === schema)) {
                    notify();
                }
            }),
        [client, connectionId, schema, notify]
    );
}
