import './test-setup.ts';
import { expect, test } from 'bun:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createSmartEditorEngine, type Editor } from '@adecore/editor';
import { createPage, typeInto } from '@adecore/editor/testing';
import { EditorView } from './EditorView.tsx';
import { ProjectLanguage } from './project-language.ts';
import { FakeLanguageService } from './testing.ts';

test('the React view mounts the real engine, forwards edits and releases its document on unmount', async () => {
    const page = createPage();
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { value: page.window, configurable: true });
    const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previousAct = globals.IS_REACT_ACT_ENVIRONMENT;
    globals.IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(page.host);
    const service = new FakeLanguageService();
    const project = new ProjectLanguage(service);
    const mounted = { editor: null as Editor | null, ready: null as Promise<void> | null };
    let unmounted = false;
    let stopped = false;
    try {
        await act(async () =>
            root.render(
                createElement(EditorView, {
                    engine: createSmartEditorEngine({ tokenizer: async () => null }),
                    options: { text: 'hello', language: 'typescript', theme: 'light' },
                    project,
                    uri: 'file:///example.ts',
                    languageId: 'typescript',
                    onMount: (editor, language) => {
                        mounted.editor = editor;
                        mounted.ready = language!.document.ready;
                        return () => {
                            stopped = true;
                        };
                    }
                })
            )
        );
        await mounted.ready;
        expect(page.host.querySelector('.se-editor')).not.toBeNull();
        expect(service.documents.get('file:///example.ts')?.text).toBe('hello');
        await act(async () => typeInto(page.window, page.host.querySelector('textarea')!, '!'));
        expect(mounted.editor!.getText()).toBe('!hello');
        expect(service.documents.get('file:///example.ts')?.text).toBe('!hello');
        await act(async () => root.unmount());
        unmounted = true;
        await Promise.resolve();
        await Promise.resolve();
        expect(stopped).toBe(true);
        expect(service.documents.size).toBe(0);
    } finally {
        if (!unmounted) {
            await act(async () => root.unmount());
        }
        project.dispose();
        globals.IS_REACT_ACT_ENVIRONMENT = previousAct;
        if (previousWindow === undefined) {
            Reflect.deleteProperty(globalThis, 'window');
        } else {
            Object.defineProperty(globalThis, 'window', previousWindow);
        }
    }
});
