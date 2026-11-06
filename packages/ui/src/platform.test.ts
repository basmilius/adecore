import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { applePlatformFrom, isApplePlatform, setApplePlatform, type ApplePlatformSource } from './platform.ts';

let previous: ApplePlatformSource | null;

beforeEach(() => {
    previous = setApplePlatform(null);
});

afterEach(() => {
    setApplePlatform(previous);
});

describe('isApplePlatform', () => {
    test('reads a Mac, an iPhone and an iPad from the platform name, and nothing else', () => {
        expect(applePlatformFrom('MacIntel')).toBe(true);
        expect(applePlatformFrom('iPhone')).toBe(true);
        expect(applePlatformFrom('iPad')).toBe(true);
        expect(applePlatformFrom('Win32')).toBe(false);
        expect(applePlatformFrom(undefined)).toBe(false);
    });

    test('follows the answer the app handed over, which wins over the page', () => {
        setApplePlatform(() => true);

        expect(isApplePlatform()).toBe(true);

        setApplePlatform(() => false);

        expect(isApplePlatform()).toBe(false);
    });

    test('leaves the answer to the page while the app has none', () => {
        const ofPage = isApplePlatform();

        setApplePlatform(() => undefined);

        expect(isApplePlatform()).toBe(ofPage);
    });

    test('hands back the source it replaced', () => {
        const first = () => true;
        setApplePlatform(first);

        expect(setApplePlatform(null)).toBe(first);
    });
});
