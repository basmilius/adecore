import { useEffect, useState } from 'react';
import { messageOf } from '@adecore/ui';
import { useDatabaseClient } from '../client-context.ts';
import { DatabaseRequestError } from '../client/types.ts';
import type { DockerContainer } from '../protocol/index.ts';

/* `unsupported` is a machine without Docker, or one the app cannot ask. */
export type DockerState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly containers: readonly DockerContainer[] }
    | { readonly status: 'unsupported'; readonly message: string }
    | { readonly status: 'error'; readonly message: string };

/* The running containers that look like a database, asked for when the component mounts and again on `reload`. */
export function useDockerContainers(): { readonly state: DockerState; reload(): void } {
    const client = useDatabaseClient();
    const [state, setState] = useState<DockerState>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        client.discover('docker', { signal: controller.signal }).then(
            (containers) => setState({ status: 'ready', containers }),
            (e: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }
                const message = messageOf(e);
                setState({ status: e instanceof DatabaseRequestError && e.code === 'unsupported' ? 'unsupported' : 'error', message });
            }
        );
        return () => controller.abort();
    }, [client, attempt]);

    const reload = (): void => {
        setState({ status: 'loading' });
        setAttempt((current) => current + 1);
    };

    return { state, reload };
}
