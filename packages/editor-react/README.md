# @adecore/editor-react

[![npm](https://img.shields.io/npm/v/@adecore/editor-react)](https://www.npmjs.com/package/@adecore/editor-react)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev/editor-react/)

Language features for [`@adecore/editor`](https://adecore.dev/editor/) over a `LanguageService` of [`@adecore/lsp`](https://adecore.dev/lsp/): suggestions and snippets, hover, signature help, problems, navigation, peek, rename, code actions, symbols, semantic colors, inlay hints, folds and code vision, with the React cards that show them. It starts no language server and touches no file; the app hands it a service and the file operations it allows.

**[Documentation with live demos](https://adecore.dev/editor-react/)**

## Install

```sh
bun add @adecore/editor-react
```

`@adecore/ui`, React 19, `react-dom`, `i18next` and `react-i18next` are peer dependencies.

## Set up

```css
@import '@adecore/ui/theme.css';
@import '@adecore/editor/editor.css';
@import '@adecore/editor-react/editor-react.css';
@source "../node_modules/@adecore/editor-react/dist";
```

Add `@adecore/editor-react/locales/en.json` and `nl.json` to i18next as the `editor` namespace, then:

```tsx
import { EditorView, ProjectLanguage } from '@adecore/editor-react';

const project = new ProjectLanguage(service, { folder, keymap, openPlace, files, notify });

<EditorView engine={engine} options={options} project={project} uri={uri} languageId="typescript" className="h-96" />;
```

## Entry points

| Import | What it holds |
|---|---|
| `@adecore/editor-react` | The components, `ProjectLanguage`, `EditorLanguage` and every model |
| `@adecore/editor-react/models` | The pure models, without React |
| `@adecore/editor-react/testing` | `FakeLanguageService` and `ManualTimers` |
| `@adecore/editor-react/editor-react.css` | The styles of the cards |
| `@adecore/editor-react/locales/*.json` | The words, in English and Dutch |

## Documentation

| Page | What it covers |
|---|---|
| [Getting started](https://adecore.dev/editor-react/getting-started) | Install, styles, words and a first editor |
| [Projects and documents](https://adecore.dev/editor-react/project) | `ProjectLanguage`, the host, shared documents and workspace edits |
| [EditorView](https://adecore.dev/editor-react/editor-view) | The component, `EditorLanguage` and the popups |
| [Views](https://adecore.dev/editor-react/completion) | A page per feature with a live demo, in the sidebar |
| [Models](https://adecore.dev/editor-react/models) | The pure functions behind the features |
| [Testing](https://adecore.dev/editor-react/testing) | `FakeLanguageService` and `ManualTimers` |

## License

FSL-1.1-MIT
