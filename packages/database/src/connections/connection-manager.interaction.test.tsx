import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Connection } from '../client/types.ts';
import type { Mounted } from '../testing/dom/harness.tsx';
import { byLabel, byText, clientOver, click, findAll, mount, waitFor } from '../testing/dom/harness.tsx';
import { SHOP_PATH, shopDatabase } from '../testing/dom/shop.ts';
import { fakeDatabaseTransport } from '../testing/index.ts';
import { ConnectionManager } from './ConnectionManager.tsx';

const shop: Connection = { id: 'shop', name: 'Shop', config: { engine: 'sqlite', path: SHOP_PATH } };
const gone: Connection = { id: 'gone', name: 'Gone', config: { engine: 'mysql', host: 'nowhere.test', user: 'root', tls: 'prefer' } };

function Controlled() {
    const [value, setValue] = useState<readonly Connection[]>([shop, gone]);
    return <ConnectionManager value={value} onValueChange={setValue} />;
}

const notices = (): HTMLElement[] => findAll('[role=status]');
const row = (name: string): HTMLElement => byText('nav button', new RegExp(`^${name}`));

describe.skipIf(typeof document === 'undefined')('the answer of Test connection in a ConnectionManager', () => {
    let mounted: Mounted;
    let client: ReturnType<typeof clientOver>;

    beforeEach(async () => {
        client = clientOver(fakeDatabaseTransport({ databases: { [SHOP_PATH]: shopDatabase } }));
        mounted = await mount(<Controlled />, { client });
    });

    afterEach(async () => {
        await mounted.unmount();
        await client.dispose();
    });

    test('shows at the top of the detail, above the form, and stays in sight while it scrolls', async () => {
        await click(byText('button', 'Test connection'));
        await waitFor(() => expect(notices()).toHaveLength(1));
        const notice = notices()[0]!;
        expect(notice.textContent).toContain('Connected to SQLite');
        expect(notice.className).toContain('sticky top-0');
        expect(notice.parentElement!.firstElementChild).toBe(notice);
    });

    test('goes with its close button', async () => {
        await click(byText('button', 'Test connection'));
        await waitFor(() => expect(notices()).toHaveLength(1));
        await click(byLabel('Dismiss'));
        expect(notices()).toEqual([]);
    });

    test('says what went wrong for a connection that fails', async () => {
        await click(row('Gone'));
        await click(byText('button', 'Test connection'));
        await waitFor(() => expect(notices()).toHaveLength(1));
        expect(notices()[0]!.textContent).not.toContain('Connected');
        expect(notices()[0]!.querySelector('[aria-label=Dismiss]')).not.toBeNull();
    });

    test('is gone once another connection is picked, and does not come back with the first', async () => {
        await click(byText('button', 'Test connection'));
        await waitFor(() => expect(notices()).toHaveLength(1));
        await click(row('Gone'));
        expect(notices()).toEqual([]);
        await click(row('Shop'));
        expect(notices()).toEqual([]);
    });

    test('is never shown for a config that changed after the test', async () => {
        await click(byText('button', 'Test connection'));
        await waitFor(() => expect(notices()).toHaveLength(1));
        await click(byLabel('Read only'));
        expect(notices()).toEqual([]);
    });
});
