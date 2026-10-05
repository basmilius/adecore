# A working composition

Set up the [UI theme and provider](/ui/utilities/ui-provider), an i18next instance shared by the coordinator and React provider, and the `editor` locale namespace before mounting. Load styles in this order:

```ts
import '@adecore/ui/theme.css';
import '@adecore/editor/editor.css';
import '@adecore/editor-react/editor-react.css';
```

React views use utility classes from UI and this package. A Tailwind host must scan installed package source (or the equivalent linked source directory) as well as its own components. The editor styles do not compile those utility classes. Follow the [UI theme setup](/ui/guide/theme) and include both packages in the host's source configuration.

## Local file with a fake service

This factory creates a language service with completion and hover and supplies generic navigation/notification adapters. It performs no file operation and runs no server.

```ts
import { createSmartEditorEngine, type EditorOptions } from '@adecore/editor';
import { resolveKeymap } from '@adecore/editor/keymap';
import { ProjectLanguage, type LanguageHost } from '@adecore/editor-react';
import { FakeLanguageService } from '@adecore/editor-react/testing';

export function createExample(host: Pick<LanguageHost, 'openPlace' | 'notify'> = {}) {
    const service = new FakeLanguageService();
    service.respond('textDocument/completion', () => [{ label: 'print', insertText: 'print(${1:value})$0', insertTextFormat: 2, kind: 3 }]);
    service.respond('textDocument/hover', () => ({
        contents: { kind: 'plaintext', value: 'Print a value.' }
    }));
    const keymap = resolveKeymap();
    const project = new ProjectLanguage(service, { ...host, folder: '/work', keymap });
    const engine = createSmartEditorEngine({ tokenizer: async () => null, keymap });
    const options: EditorOptions = {
        text: 'pri',
        path: '/work/example.ts',
        language: 'typescript',
        theme: 'light'
    };
    return { service, project, engine, options };
}
```

Mount the factory result once for the owning project. Keep the `engine`, `options`, and callback identities stable while the same file is open.

```tsx
import { EditorView } from '@adecore/editor-react';
import type { EditorEngine, EditorOptions } from '@adecore/editor';
import type { ProjectLanguage } from '@adecore/editor-react';

export function ExampleFile({ engine, options, project }: { engine: EditorEngine; options: EditorOptions; project: ProjectLanguage }) {
    return (
        <EditorView engine={engine} options={options} project={project} uri="file:///work/example.ts" languageId="typescript" className="relative min-h-0" />
    );
}
```

The parent must give this component a real height, for example a 400-pixel editor region. `EditorView` mounts the engine, attaches `EditorLanguage` only when `project`, `uri`, and `languageId` are all supplied, and draws `LanguagePopups`. On cleanup it runs the function returned by `onMount`, disposes the attached language features, and then disposes the editor. It does not dispose the shared project.

The effect depends on all mount props, including the `options` object and `onMount` function. Recreating either on every render remounts the editor and loses its local history. For live theme, wrap, read-only, or text updates, keep the mount stable and use `Editor` setters from a retained handle. Use a deliberate remount when file identity or engine policy changes.

## The same flow without React mounting

```ts
import type { EditorEngine, EditorOptions } from '@adecore/editor';
import { EditorLanguage, type ProjectLanguage } from '@adecore/editor-react';

export async function attachFile(
    container: HTMLElement,
    engine: EditorEngine,
    options: EditorOptions,
    project: ProjectLanguage,
    uri: string,
    languageId: string
) {
    const editor = engine.mount(container, options);
    const language = new EditorLanguage(project, editor, uri, languageId);
    try {
        await language.document.ready;
        return {
            editor,
            language,
            dispose() {
                language.dispose();
                editor.dispose();
            }
        };
    } catch (error) {
        language.dispose();
        editor.dispose();
        throw error;
    }
}
```

Render `LanguagePopups` for that attached instance if using a manual mount inside React. Do not attach another `EditorLanguage` to an `EditorView` that already created one. `project.dispose()` belongs to project/window teardown after its file views unmount. A real service adapter replaces the fake while preserving the [`LanguageService` contract](/lsp/handbook/testing-host#implementing-languageservice).
