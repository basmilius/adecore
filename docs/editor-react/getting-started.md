# Getting started

## Install

::: code-group

```sh [bun]
bun add @adecore/editor-react
```

```sh [npm]
npm install @adecore/editor-react
```

```sh [pnpm]
pnpm add @adecore/editor-react
```

:::

`@adecore/ui`, React 19, `react-dom`, `i18next` and `react-i18next` are peer dependencies. The package brings `@adecore/editor` and `@adecore/lsp` along. Set up [`@adecore/ui`](/ui/guide/getting-started) first.

## Styles

Import the styles in this order and let Tailwind scan the package, whose cards use Tailwind classes. The `@source` path is relative to the CSS file.

```css
@import 'tailwindcss';
@import '@adecore/ui/theme.css';
@import '@adecore/editor/editor.css';
@import '@adecore/editor-react/editor-react.css';

@source "../node_modules/@adecore/ui/dist";
@source "../node_modules/@adecore/editor-react/dist";
```

## Words

The words live in the `editor` namespace, in English and Dutch. Add them before the first editor mounts. The cards read them from the `UIProvider` instance; the features' notices use the `i18n` of the project's [host](/editor-react/project#languagehost), or the default `i18next` instance.

```ts
import i18next from 'i18next';
import en from '@adecore/editor-react/locales/en.json';
import nl from '@adecore/editor-react/locales/nl.json';

i18next.addResourceBundle('en', 'editor', en);
i18next.addResourceBundle('nl', 'editor', nl);
```

An app with its own instance adds the bundles there and passes it to `UIProvider` and, as `i18n`, to every `ProjectLanguage`.

## A first editor

A `ProjectLanguage` holds a project's language service. `EditorView` mounts an editor, attaches the features when it has a `project`, `uri` and `languageId`, and draws their cards.

```tsx
import { createSmartEditorEngine } from '@adecore/editor';
import { EditorView, ProjectLanguage } from '@adecore/editor-react';
import { FakeLanguageService } from '@adecore/editor-react/testing';

const service = new FakeLanguageService();
service.respond('textDocument/completion', () => [{ label: 'greeting', kind: 6 }]);
service.respond('textDocument/hover', () => ({ contents: { kind: 'markdown', value: '`greeting: string`' } }));

const project = new ProjectLanguage(service, { folder: '/work' });
const engine = createSmartEditorEngine({ tokenizer: async () => null });
const options = { text: 'const greeting = "hello";\n', language: 'typescript', theme: 'github-light' };

export function File() {
    return <EditorView engine={engine} options={options} project={project} uri="file:///work/example.ts" languageId="typescript" className="h-96" />;
}
```

`FakeLanguageService` answers what a test registers. A real app passes a [`LanguageService`](/lsp/language-service) over its language servers.

Keep `engine`, `project`, `uri` and `languageId` stable between renders: changing one remounts the editor and loses its history. To change the theme, wrap or read-only state of an open file, use the setters of the `Editor` that `onMount` receives.

Call `project.dispose()` after its editors when the window or project closes. Stop the language servers separately.

## A real language server

Replace `FakeLanguageService` with a `LanguageService` over the app's servers. [Getting started with the LSP client](/lsp/getting-started) starts a server and sketches a service over one session. Hand the project the file operations it may use, so a rename across files can stage drafts; see [Workspace edits](/editor-react/workspace-edits).

## Checklist

- The page imports the theme, `editor.css` and `editor-react.css` in that order, and Tailwind scans the package.
- The `editor` words are added before the first editor mounts, to the same i18next instance `UIProvider` gets.
- `engine`, `project`, `uri` and `languageId` are stable between renders.
- `uri` is a `file:` URI made with `pathToFileUri`, the same one the servers see.
- The host has `openPlace`, which going to a definition in another file calls.
- The project is disposed after its editors.
