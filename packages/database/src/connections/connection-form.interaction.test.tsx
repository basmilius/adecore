import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Connection } from '../client/types.ts';
import type { DockerContainer } from '../protocol/index.ts';
import type { Mounted } from '../testing/dom/harness.tsx';

import { byText, clientOver, click, find, findAll, mount, recordTransport, waitFor } from '../testing/dom/harness.tsx';
import { fakeDatabaseTransport } from '../testing/index.ts';
import { ConnectionForm } from './ConnectionForm.tsx';

const containers: DockerContainer[] = [
    {
        id: 'a1',
        name: 'shop-db-1',
        image: 'mysql:8.4',
        engine: 'mysql',
        ports: [{ container: 3306, host: 33306 }],
        project: 'shop',
        service: 'db',
        suggested: { user: 'app', password: 'secret', database: 'shop' }
    },
    {
        id: 'b2',
        name: 'blog-mariadb',
        image: 'mariadb:11',
        engine: 'mysql',
        ports: [{ container: 3306, host: null }],
        project: null,
        service: null,
        suggested: { user: 'blog' }
    }
];

const initial: Connection = { id: 'one', name: 'Shop', config: { engine: 'mysql', host: 'db.test', user: '', tls: 'prefer' } };

function Controlled({ start, onValue }: { start: Connection; onValue(value: Connection): void }) {
    const [value, setValue] = useState(start);
    return (
        <ConnectionForm
            value={value}
            onValueChange={(next) => {
                setValue(next);
                onValue(next);
            }}
        />
    );
}

describe.skipIf(typeof document === 'undefined')('ConnectionForm in a DOM', () => {
    let values: Connection[];
    let mounted: Mounted;
    let client: ReturnType<typeof clientOver>;
    let discoveries: number;

    const open = async (start: Connection = initial): Promise<void> => {
        const recorded = recordTransport(fakeDatabaseTransport({ databases: {}, containers }));
        client = clientOver(recorded.transport);
        mounted = await mount(<Controlled start={start} onValue={(value) => values.push(value)} />, { client });
        discoveries = recorded.of('discover').length;
    };

    beforeEach(() => {
        values = [];
    });

    afterEach(async () => {
        await mounted.unmount();
        await client.dispose();
    });

    const latest = (): Connection => values.at(-1)!;

    test('lists the discovered containers in Docker mode and fills the empty fields from the one picked', async () => {
        await open();
        expect(discoveries).toBe(0);

        await click(byText('[role=radio]', 'Docker'));
        expect(latest().config).toMatchObject({ engine: 'mysql', tunnel: { kind: 'docker', container: '' } });
        await waitFor(() => expect(document.body.textContent).not.toContain('Looking for containers'));

        await click(find('button[aria-label=Container]'));
        const options = findAll('[role=option]');
        expect(options.map((option) => option.textContent)).toEqual([expect.stringContaining('shop-db-1'), expect.stringContaining('blog-mariadb')]);
        expect(options[0]!.textContent).toContain('mysql:8.4');
        expect(options[0]!.textContent).toContain('Published on port 33306');
        expect(options[1]!.textContent).toContain('Not published');

        await click(options[0]!);
        expect(latest().config).toMatchObject({
            engine: 'mysql',
            user: 'app',
            password: 'secret',
            database: 'shop',
            tunnel: { kind: 'docker', container: 'shop-db-1', port: 3306 }
        });
    });

    test('keeps what is already filled in when a container is picked', async () => {
        await open({ ...initial, config: { engine: 'mysql', host: 'db.test', user: 'me', password: 'mine', tls: 'prefer' } });
        await click(byText('[role=radio]', 'Docker'));
        await click(find('button[aria-label=Container]'));
        await click(findAll('[role=option]')[0]!);

        expect(latest().config).toMatchObject({ user: 'me', password: 'mine', database: 'shop' });
    });

    test('says so when no container looks like a database', async () => {
        const recorded = recordTransport(fakeDatabaseTransport({ databases: {} }));
        client = clientOver(recorded.transport);
        mounted = await mount(<Controlled start={initial} onValue={(value) => values.push(value)} />, { client });
        await click(byText('[role=radio]', 'Docker'));

        await waitFor(() => expect(document.body.textContent).toContain('No running containers that look like a database.'));
    });

    test('asks again for the containers when the refresh button is pressed', async () => {
        const recorded = recordTransport(fakeDatabaseTransport({ databases: {}, containers }));
        client = clientOver(recorded.transport);
        mounted = await mount(<Controlled start={initial} onValue={(value) => values.push(value)} />, { client });
        await click(byText('[role=radio]', 'Docker'));
        expect(recorded.of('discover')).toHaveLength(1);

        await click(find('button[aria-label="Look for containers again"]'));
        expect(recorded.of('discover')).toHaveLength(2);
    });
});
