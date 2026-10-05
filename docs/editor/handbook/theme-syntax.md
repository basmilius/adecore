# Theme and syntax

Load `@adecore/ui/theme.css`, then `@adecore/editor/editor.css`, then host overrides. The editor CSS provides `--editor-*`, `--find-*`, `--agent-1` through `--agent-6`, and `--agent-ink` defaults. It still uses shared UI tokens such as `--surface`, `--surface-raised`, `--text`, `--accent`, status colors, and mono typography. A host without UI CSS must define equivalent tokens itself.

The page's `[data-theme='light']` or `[data-theme='dark']` selects chrome colors. `EditorOptions.theme` / `setTheme` selects a Shiki syntax theme by id. Set both when switching modes; calling `setTheme` does not change the page's data attribute.

The code face reads `--font-mono`, `--code-font-size` (falling back to `--text-code`), and `--code-line-height` (falling back to `--text-code--line-height`). Keep code dimensions consistent with the rest of the host and call `refreshFont` when those dimensions change. `--term-fg` can override the base text color; otherwise `--text` is used.

## Shared Shiki highlighter

```ts
import { createHighlighter } from 'shiki';
import { createSmartEditorEngine, shikiScopeColors, shikiTokenizers } from '@adecore/editor';

let highlighter: ReturnType<typeof createHighlighter> | undefined;
const getHighlighter = () => (highlighter ??= createHighlighter({ themes: [], langs: [] }));

export const engine = createSmartEditorEngine({
    tokenizer: shikiTokenizers(getHighlighter),
    scopeColors: shikiScopeColors(getHighlighter)
});
```

Mount with a real theme id, for example `github-light`, and a grammar id such as `typescript`. Loading is lazy and shared. The host owns the highlighter lifetime; do not dispose it while live editors or other code views use it. Failure to load a language or theme yields plain text rather than a failed mount.

`TokenizerSource(language, theme, text?)` returns `Promise<LineTokenizer | null>`. A `LineTokenizer` receives one line and its preceding state; it returns `TokenizedLine` containing `LineToken` runs and the next state. Runs add up to the line's UTF-16 length. Colors can be CSS colors or empty for default text; `fontStyle` uses Shiki bit flags (italic 1, bold 2, underline 4, strike 8).

`sameState` decides where recoloring may stop after an edit. `stale?()` reports that previously issued states are invalid, for example when loading an embedded grammar rebuilds the host grammar. Keep state comparison correct when implementing another tokenizer; false equality leaves later lines with incorrect colors.

The `/shiki` entry point also exports `loadGrammar` and `documentLanguageOf`. Embedded grammar loading follows languages named by the initial document, such as a style block's `lang` or a Markdown fence. A newly added embedded language may need reopening to load. The PHP document grammar combines HTML with PHP between tags; PHP inside an HTML attribute is not colored.

## Semantic colors

`setSemanticTokens` supplies editor tokens classified as TextMate scope stacks. `scopeColors(theme)` supplies the rules that color those scopes; without it semantic tokens do not override grammar colors. [`editor-react`](/editor-react/handbook/diagnostics-tokens) decodes LSP semantic tokens using the server's legend. Syntax tokenization and semantic classification are separate inputs, and either can be unavailable.

Attribution and review colors accept a CSS custom-property name or a CSS color. `AGENT_COLORS` lists the published palette names; the host maps its own authors or sessions to those values. The palette does not identify an agent or fetch provenance.
