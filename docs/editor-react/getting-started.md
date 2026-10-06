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

`@adecore/ui`, React 19, `react-dom`, `i18next` and `react-i18next` are peer dependencies, so the app brings them. `@adecore/editor` and `@adecore/lsp` come along. Set up [`@adecore/ui`](/ui/guide/getting-started) first.

## Styles

Import the styles in this order and let Tailwind scan the package, since the cards are built from Tailwind classes. The `@source` path is relative to the CSS file.

```css
@import 'tailwindcss';
@import '@adecore/ui/theme.css';
@import '@adecore/editor/editor.css';
@import '@adecore/editor-react/editor-react.css';

@source "../node_modules/@adecore/ui/dist";
@source "../node_modules/@adecore/editor-react/dist";
```

## Words

The package's words live in the `editor` namespace, in English and Dutch. Add them before the first editor mounts. The cards read them through `react-i18next` from the instance of `UIProvider`; the features read them from the `i18n` of the project's [host](/editor-react/project#languagehost), for the notices they send, and from the default `i18next` instance without one.

```ts
import i18next from 'i18next';
import en from '@adecore/editor-react/locales/en.json';
import nl from '@adecore/editor-react/locales/nl.json';

i18next.addResourceBundle('en', 'editor', en);
i18next.addResourceBundle('nl', 'editor', nl);
```

An app with an instance of its own adds the bundles to it and hands it to both: to `UIProvider`, and as `i18n` to every `ProjectLanguage`.

## A first editor

A `ProjectLanguage` holds the language service of a project. `EditorView` mounts an editor, attaches the features to it when it has a `project`, `uri` and `languageId`, and draws their cards.

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

`FakeLanguageService` answers what a test registers. A real app hands `ProjectLanguage` a [`LanguageService`](/lsp/language-service) over its language servers.

Keep `engine`, `options`, `project` and `onMount` the same between renders: `EditorView` mounts the editor again when one of them changes, and the history goes with it. To change the theme, wrap or read-only state of an open file, call the setters of the `Editor` that `onMount` hands over.

Dispose the project when the window or project closes, after its editors: `project.dispose()`. Stop the language servers behind the service separately.
