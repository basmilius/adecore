import { describe, expect, test } from 'bun:test';
import { ErrorCodes, LspError } from './connection.ts';
import { unservedLanguageService } from './unserved.ts';

describe('unservedLanguageService', () => {
    test('takes documents and supports nothing', async () => {
        const service = unservedLanguageService();

        await service.openDocument({ uri: 'file:///a.txt', languageId: 'plaintext', text: 'a' });
        await service.changeDocument('file:///a.txt', []);
        await service.closeDocument('file:///a.txt');

        expect(service.supports('textDocument/hover', 'file:///a.txt')).toBe(false);
        expect(service.providerOptions('textDocument/completion', 'file:///a.txt')).toBeUndefined();
    });

    test('hands out inert subscriptions', () => {
        const service = unservedLanguageService();

        expect(() => service.onProvidersChanged(() => undefined).dispose()).not.toThrow();
        expect(() => service.onDiagnostics(() => undefined).dispose()).not.toThrow();
    });

    test('rejects a request with method not found', async () => {
        const service = unservedLanguageService();
        const error = await service.hover('file:///a.txt', { line: 0, character: 0 }).catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(LspError);
        expect((error as LspError).code).toBe(ErrorCodes.MethodNotFound);
    });

    test('leaves the optional members out', () => {
        const service = unservedLanguageService();

        expect(service.onTypeFormatting).toBeUndefined();
        expect(service.prepareCallHierarchy).toBeUndefined();
        expect(service.versionOf).toBeUndefined();
    });
});
