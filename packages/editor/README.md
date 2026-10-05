# @adecore/editor

[![npm](https://img.shields.io/npm/v/@adecore/editor)](https://www.npmjs.com/package/@adecore/editor)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev/editor/)

A code editor for the DOM. It draws a [`DocumentModel`](https://adecore.dev/editor-core/) with a layout of its own, renders only the rows in view, and takes the decorations, rows and marks a host hands it: problems, inlay hints, semantic colors, change marks, widgets between lines, code vision, agent attribution and ghost text. It knows no language server; [`@adecore/editor-react`](https://adecore.dev/editor-react/) adds one.

**[Documentation with live demos](https://adecore.dev/editor/)**

## Install

```sh
bun add @adecore/editor
```

## Set up

```css
@import '@adecore/ui/theme.css';
@import '@adecore/editor/editor.css';
```

```ts
import { createSmartEditorEngine, shikiTokenizers } from '@adecore/editor';

const engine = createSmartEditorEngine({ tokenizer: shikiTokenizers(getHighlighter) });
const editor = engine.mount(element, { text, language: 'typescript', theme: 'github-light' });
```

The element needs a position and a size from its parent.

## Entry points

| Import | What it holds |
|---|---|
| `@adecore/editor` | `createSmartEditorEngine`, the `Editor` contract and its types, the Shiki adapters |
| `@adecore/editor/editor.css` | The styles |
| `@adecore/editor/shiki` | The Shiki adapters and grammar loading |
| `@adecore/editor/keymap` | The key table, `resolveKeymap`, `chordOf` and `parseChord` |
| `@adecore/editor/fake` | `FakeEditorEngine`, for tests of host code |
| `@adecore/editor/testing` | `mountEditor` on a LinkeDOM page |

## Documentation

| Page | What it covers |
|---|---|
| [Getting started](https://adecore.dev/editor/getting-started) | Install, styles, mounting and the engine options |
| [Options and keymaps](https://adecore.dev/editor/options) | Every option and setter, smart keys and the key table |
| [Text and events](https://adecore.dev/editor/editing) | Positions, edits, selections, events and tracked ranges |
| [Decorations](https://adecore.dev/editor/decorations), [Rows and widgets](https://adecore.dev/editor/rows), [Agents](https://adecore.dev/editor/agents) | What a host draws into the editor |
| [Find and folding](https://adecore.dev/editor/find-folding) | The find matcher, folds and sticky scroll |
| [Theme and syntax](https://adecore.dev/editor/theme) | CSS tokens, Shiki and a tokenizer of your own |
| [Testing](https://adecore.dev/editor/testing) | `mountEditor` and `FakeEditorEngine` |

## License

FSL-1.1-MIT
