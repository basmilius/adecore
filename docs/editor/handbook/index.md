# Mounting a browser editor

`@adecore/editor` draws a file editor over [`@adecore/editor-core`](/editor-core/handbook/). Its engine mounts into a sized DOM element and returns an imperative `Editor`. It accepts language decorations and host widgets, but it does not launch language servers, save files, or create agent requests. [`@adecore/editor-react`](/editor-react/handbook/) adds language coordination and React popups.

The package is private at `0.0.0` pending publication. Local source use selects the `source` export condition; compiled use reads `dist` after `bun run --cwd packages/editor build`. Package dependencies must be available in the checkout. These chapters do not assume an npm release exists.

## A plain-text mount

Import the styles once in the browser entry point. The UI theme supplies the shared color and typography tokens; hosts using another theme must supply equivalent values as described in [theme and syntax](./theme-syntax).

```ts
import '@adecore/ui/theme.css';
import '@adecore/editor/editor.css';
import { createSmartEditorEngine, type Editor } from '@adecore/editor';

export function mountFile(
    container: HTMLElement,
    initialText: string,
    save: (text: string) => Promise<void>,
    onError: (error: unknown) => void
): { editor: Editor; dispose(): void } {
    const engine = createSmartEditorEngine({ tokenizer: async () => null });
    const editor = engine.mount(container, {
        text: initialText,
        theme: 'light',
        wrap: false,
        indentation: { tabSize: 4, insertSpaces: true }
    });
    const stopSave = editor.onSave(() => {
        void save(editor.getText()).catch(onError);
    });
    return {
        editor,
        dispose() {
            stopSave();
            editor.dispose();
        }
    };
}
```

`container` needs a positioned box and an explicit size from its parent, for example `position: relative; height: 400px; min-width: 0`. A flex or grid ancestor may need `min-height: 0`. The editor fills the box and owns its children. Use one mount per box, and dispose it before replacing the box or mounting another editor there.

The `save` function above is a host adapter. It receives text when the editor reports Mod+S. The host decides the path, authorization, conflict detection, write operation, and dirty-state reset. This is a separate file editor; it is not a chat input component.

Continue with [configuration and keymaps](./configuration), [editing and events](./editing), [rendering and large files](./rendering), [theme and syntax](./theme-syntax), [search, folds, and widgets](./search-widgets), and [testing and migration](./testing-migration).

## Public entry points

| Import                       | Purpose                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `@adecore/editor`            | Engine, `Editor` contract, public types, default smart keys, Shiki adapters, attribution palette |
| `@adecore/editor/editor.css` | Layout and default editor colors                                                                 |
| `@adecore/editor/shiki`      | Shiki integration, including grammar-loading helpers                                             |
| `@adecore/editor/keymap`     | Key table, overrides, chord resolution/parsing                                                   |
| `@adecore/editor/fake`       | `FakeEditor` / `FakeEditorEngine` for host tests                                                 |
| `@adecore/editor/testing`    | DOM mounting and interaction helpers                                                             |
