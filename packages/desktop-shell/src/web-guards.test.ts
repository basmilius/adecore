import { describe, expect, test } from 'bun:test';
import { appWindowNavigation, isAppSender, isExternalLink, originOf } from './web-guards.ts';

const WEB_APP = 'http://127.0.0.1:4210';
const SCHEME_APP = 'app://main';
const SCHEMES = ['app'];

describe('originOf', () => {
    test('reads the origin of a web address and nothing else', () => {
        expect(originOf('http://127.0.0.1:4210/some/view?x=1')).toBe(WEB_APP);
        expect(originOf('about:blank')).toBeNull();
        expect(originOf('data:text/html,<p>hi</p>')).toBeNull();
        expect(originOf('not a url')).toBeNull();
    });

    test('gives a registered scheme the origin Chromium gives it, per host', () => {
        expect(originOf('app://main/index.html', SCHEMES)).toBe(SCHEME_APP);
        expect(originOf('app://MAIN/', SCHEMES)).toBe(SCHEME_APP);
        expect(originOf('app://render/index.html', SCHEMES)).toBe('app://render');
        expect(originOf('app:main', SCHEMES)).toBeNull();
    });

    test('a scheme the app did not register has no origin', () => {
        expect(originOf('app://main/index.html')).toBeNull();
    });
});

describe('appWindowNavigation', () => {
    test('keeps the app in its window', () => {
        expect(appWindowNavigation('http://127.0.0.1:4210/', WEB_APP)).toBe('allow');
        expect(appWindowNavigation('http://127.0.0.1:4210/link?code=abc', WEB_APP)).toBe('allow');
        expect(appWindowNavigation('app://main/project/abc', SCHEME_APP, SCHEMES)).toBe('allow');
    });

    test('sends a dropped web link to the system browser', () => {
        expect(appWindowNavigation('https://example.com/', WEB_APP)).toBe('external');
        expect(appWindowNavigation('http://example.com/', SCHEME_APP, SCHEMES)).toBe('external');
    });

    test('a port, host or part of the scheme that only looks like the app is not the app', () => {
        expect(appWindowNavigation('http://127.0.0.1:4211/', WEB_APP)).toBe('external');
        expect(appWindowNavigation('http://localhost:4210/', WEB_APP)).toBe('external');
        expect(appWindowNavigation('https://127.0.0.1:4210/', WEB_APP)).toBe('external');
        expect(appWindowNavigation('app://render/index.html', SCHEME_APP, SCHEMES)).toBe('refuse');
    });

    test('refuses a dropped file and every other scheme', () => {
        expect(appWindowNavigation('file:///Users/someone/page.html', WEB_APP)).toBe('refuse');
        expect(appWindowNavigation('data:text/html,<script>1</script>', WEB_APP)).toBe('refuse');
        expect(appWindowNavigation('javascript:alert(1)', WEB_APP)).toBe('refuse');
        expect(appWindowNavigation('mailto:someone@example.com', WEB_APP)).toBe('refuse');
        expect(appWindowNavigation('about:blank', WEB_APP)).toBe('refuse');
    });
});

describe('isAppSender', () => {
    const top = { url: `${WEB_APP}/`, parent: null };

    test('the top frame of an app window on the app origin', () => {
        expect(isAppSender(true, top, WEB_APP)).toBe(true);
        expect(isAppSender(true, { url: 'app://main/', parent: null }, SCHEME_APP, SCHEMES)).toBe(true);
    });

    test('not another web contents, whatever it loaded', () => {
        expect(isAppSender(false, top, WEB_APP)).toBe(false);
    });

    test('not an app window once it was navigated somewhere else', () => {
        expect(isAppSender(true, { url: 'https://example.com/', parent: null }, WEB_APP)).toBe(false);
        expect(isAppSender(true, { url: 'file:///tmp/dropped.html', parent: null }, WEB_APP)).toBe(false);
    });

    test('not a frame inside the app, nor a frame that is gone', () => {
        expect(isAppSender(true, { url: `${WEB_APP}/`, parent: top }, WEB_APP)).toBe(false);
        expect(isAppSender(true, null, WEB_APP)).toBe(false);
    });
});

describe('isExternalLink', () => {
    test('web and mail links leave for the system, a file or an app never does', () => {
        expect(isExternalLink('https://example.com/')).toBe(true);
        expect(isExternalLink('HTTP://example.com/')).toBe(true);
        expect(isExternalLink('mailto:someone@example.com')).toBe(true);
        expect(isExternalLink('file:///Applications/Calculator.app')).toBe(false);
        expect(isExternalLink('ssh://host')).toBe(false);
        expect(isExternalLink('javascript:alert(1)')).toBe(false);
    });
});
