import { describe, expect, test } from 'bun:test';
import { compareVersions, isVersion } from './versions.ts';

describe('compareVersions', () => {
    test('orders by number and not by text', () => {
        expect(compareVersions('0.0.10', '0.0.9')).toBeGreaterThan(0);
        expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0);
        expect(compareVersions('0.0.8', '0.0.8')).toBe(0);
        expect(compareVersions('0.0.7', '0.0.8')).toBeLessThan(0);
    });

    test('a prerelease comes before its own release and after the release before it', () => {
        expect(compareVersions('0.29.0-beta.4', '0.29.0')).toBeLessThan(0);
        expect(compareVersions('0.29.0', '0.29.0-beta.4')).toBeGreaterThan(0);
        expect(compareVersions('0.29.0-beta.4', '0.28.0')).toBeGreaterThan(0);
        expect(compareVersions('0.29.0-beta.4', '0.29.0-beta.4')).toBe(0);
    });

    test('prereleases follow semver: numbers by value and below words, and a longer list above the one it starts with', () => {
        expect(compareVersions('0.29.0-beta.10', '0.29.0-beta.9')).toBeGreaterThan(0);
        expect(compareVersions('0.29.0-alpha.2', '0.29.0-beta.1')).toBeLessThan(0);
        expect(compareVersions('0.29.0-1', '0.29.0-beta')).toBeLessThan(0);
        expect(compareVersions('0.29.0-beta', '0.29.0-beta.1')).toBeLessThan(0);
    });

    test('anything that is not a version sorts below every version', () => {
        expect(compareVersions('0.0.1', 'nightly')).toBeGreaterThan(0);
        expect(compareVersions('nightly', 'nightly')).toBe(0);
    });

    test('a tag is not a version: the `v` comes off before anything is compared', () => {
        expect(compareVersions('v0.0.9', '0.0.8')).toBeLessThan(0);
    });
});

describe('isVersion', () => {
    test('a bare semver and nothing else', () => {
        expect(isVersion('1.2.3')).toBe(true);
        expect(isVersion('v1.2.3')).toBe(false);
        expect(isVersion('1.2')).toBe(false);
        expect(isVersion('1.2.3-')).toBe(false);
        expect(isVersion('1.2.3-beta..1')).toBe(false);
        expect(isVersion('1.2.3+build')).toBe(false);
    });

    test('a prerelease is a version too', () => {
        expect(isVersion('1.2.3-beta.1')).toBe(true);
    });
});
