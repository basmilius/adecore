# Getting started

## Install

::: code-group

```sh [bun]
bun add @adecore/editor
```

```sh [npm]
npm install @adecore/editor
```

```sh [pnpm]
pnpm add @adecore/editor
```

:::

The package brings `@adecore/editor-core` and Shiki along. It has no React and no peer dependencies.

## Styles

Import the [`@adecore/ui`](/ui/guide/theme) theme first and the editor's styles after it. The editor's `--editor-*`, `--find-*` and `--agent-*` tokens build on the theme's.

```css
@import '@adecore/ui/theme.css';
@import '@adecore/editor/editor.css';
```

An app without that theme defines the base tokens itself; see [Theme and syntax](/editor/theme#css-tokens).

## Mount an editor

Create an engine once and mount it into an element. The editor fills the element.

```ts
import { createSmartEditorEngine } from '@adecore/editor';

const engine = createSmartEditorEngine({ tokenizer: async () => null });

const editor = engine.mount(element, {
    text: 'const greeting = "hello";\n',
    language: 'typescript',
    theme: 'github-light'
});

const stopSave = editor.onSave(() => save(editor.getText()));
```

`text` and `theme` are required. [Options and keymaps](/editor/options) lists the rest. The tokenizer above colors nothing; [Theme and syntax](/editor/theme) wires Shiki.

Give the element a position and size, such as `position: relative; height: 400px`. In a flex or grid layout, its parent may also need `min-height: 0`. The editor follows the element's size.

Mod+S (Cmd+S on a Mac, Ctrl+S elsewhere) only calls the `onSave` listeners. The app does the saving.

## Engine options

One engine mounts any number of editors. Each has its own document, history and decorations.

| `SmartEditorEngineOptions` | Default  | Meaning                                                                             |
| -------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `tokenizer`                | required | Returns the `LineTokenizer` for a language and theme, or `null` for plain text      |
| `scopeColors`              |          | The colors of a theme by TextMate scope; without it semantic tokens are ignored     |
| `keymap`                   | `KEYMAP` | The key table, or a function that returns it; see [keymaps](/editor/options#keymaps) |
| `handBack`                 | `[]`     | `KeyChord`s the editor leaves alone, so the app's own shortcuts work from inside it, or a function that returns them |
| `apple`                    | `false`  | Read Ctrl and Meta the way macOS does                                               |

The editor is editable while the tokenizer loads, and ignores a tokenizer that fails or answers after a newer theme was set.

## Tear down

`dispose()` removes the editor's DOM and listeners. Call the functions `on*` methods return when a listener goes away earlier. Dispose an editor before mounting another into the same element.

```ts
stopSave();
editor.dispose();
```

## Checklist

- The page imports `theme.css` and then `editor.css`.
- The element has a position and a height, and its flex or grid parent has `min-height: 0`.
- One engine serves every editor, with the same resolved [key table](/editor/options#keymaps) the app's menus print.
- `label` names each editor in the app's language.
- The app saves in `onSave`; the editor writes nothing.
- Every editor is disposed before its element goes or another editor mounts into it.
