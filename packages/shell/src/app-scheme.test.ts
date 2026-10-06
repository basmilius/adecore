import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_SCHEME_PRIVILEGES, createAppScheme, segmentsOf } from './app-scheme.ts';

const ROOT = mkdtempSync(join(tmpdir(), 'app-scheme-'));
const PAGE = join(ROOT, 'page');
const RENDER = join(ROOT, 'render');
mkdirSync(join(PAGE, 'assets'), { recursive: true });
mkdirSync(RENDER);
writeFileSync(join(PAGE, 'index.html'), '<!doctype html><p>page</p>');
writeFileSync(join(PAGE, 'assets', 'main.js'), 'export {};');
writeFileSync(join(PAGE, 'assets', 'shiki.wasm'), new Uint8Array([0, 97, 115, 109]));
writeFileSync(join(RENDER, 'index.html'), '<p>render</p>');
writeFileSync(join(ROOT, 'secret.txt'), 'secret');
symlinkSync(join(ROOT, 'secret.txt'), join(PAGE, 'assets', 'leak.txt'));

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

const scheme = createAppScheme({
    scheme: 'app',
    root: PAGE,
    headers: { 'content-security-policy': "default-src 'self'" },
    hosts: {
        render: { root: RENDER, headers: (file) => ({ 'x-file': file.endsWith('index.html') ? 'page' : 'other' }) },
        echo: (_request, url) => new Response(url.pathname)
    }
});

const get = (url: string): Promise<Response> => scheme.handle(new Request(url));

describe('createAppScheme', () => {
    test('serves the built page, with its type and its policy', async () => {
        const page = await get('app://app/');
        expect(page.status).toBe(200);
        expect(await page.text()).toContain('page');
        expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8');
        expect(page.headers.get('content-security-policy')).toBe("default-src 'self'");
        const script = await get('app://app/assets/main.js');
        expect(script.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    });

    test('gives WebAssembly the type it needs to compile while it streams', async () => {
        expect((await get('app://app/assets/shiki.wasm')).headers.get('content-type')).toBe('application/wasm');
    });

    test('answers an address without an extension with the page, and a missing file with a 404', async () => {
        expect(await (await get('app://app/projects/42')).text()).toContain('page');
        expect((await get('app://app/assets/gone.js')).status).toBe(404);
    });

    test('serves nothing outside the folder, also through an escaped path or a symlink', async () => {
        expect((await get('app://app/../secret.txt')).status).toBe(404);
        expect((await get('app://app/%2e%2e/secret.txt')).status).toBe(404);
        expect((await get('app://app/assets%2F..%2F..%2Fsecret.txt')).status).toBe(404);
        expect((await get('app://app/assets/leak.txt')).status).toBe(404);
    });

    test('serves the other hosts by their own folder or resolver, and no host it does not know', async () => {
        const render = await get('app://render/');
        expect(await render.text()).toContain('render');
        expect(render.headers.get('x-file')).toBe('page');
        expect(render.headers.get('content-security-policy')).toBeNull();
        expect((await get('app://render/other')).status).toBe(404);
        expect(await (await get('app://echo/a/b')).text()).toBe('/a/b');
        expect((await get('app://elsewhere/')).status).toBe(404);
        expect((await get('other://app/')).status).toBe(404);
    });

    test('names the scheme with its privileges for the registration', () => {
        expect(scheme.privileged).toEqual({ scheme: 'app', privileges: APP_SCHEME_PRIVILEGES });
        expect(scheme.url).toBe('app://app/');
    });

    test('hands the guards the scheme and the origin once', () => {
        expect(scheme.origin).toBe('app://app');
        expect(scheme.isAppUrl('app://APP/settings')).toBe(true);
        expect(scheme.isAppUrl('app://render/')).toBe(false);
        expect(scheme.navigation('https://example.com/')).toBe('external');
        expect(scheme.navigation('app://app/x')).toBe('allow');
        expect(scheme.isAppSender(true, { url: 'app://app/', parent: null })).toBe(true);
        expect(scheme.isAppSender(true, { url: 'app://render/', parent: null })).toBe(false);
    });

    test('takes the origin of a dev server for the app while the window loads it', () => {
        const dev = createAppScheme({ scheme: 'app', root: PAGE, pageUrl: 'http://localhost:5173/' });
        expect(dev.url).toBe('http://localhost:5173/');
        expect(dev.origin).toBe('http://localhost:5173');
        expect(dev.isAppUrl('app://app/')).toBe(false);
    });

    test('lets a resolver serve a file it found, inside its folder only', async () => {
        const request = new Request('app://files/x');
        expect((await scheme.serveFile(PAGE, join(PAGE, 'assets', 'main.js'), request)).status).toBe(200);
        expect((await scheme.serveFile(PAGE, join(ROOT, 'secret.txt'), request)).status).toBe(404);
    });
});

describe('segmentsOf', () => {
    test('decodes the segments and refuses one that could climb out', () => {
        expect(segmentsOf('/a/b%20c')).toEqual(['a', 'b c']);
        expect(segmentsOf('/')).toEqual([]);
        expect(segmentsOf('/a/../b')).toBeNull();
        expect(segmentsOf('/a%2Fb')).toBeNull();
        expect(segmentsOf('/a//b')).toBeNull();
        expect(segmentsOf('/%E0%A4%A')).toBeNull();
    });
});
