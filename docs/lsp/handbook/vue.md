# Coordinating Vue and TypeScript

`bridgeVueTypeScript(vue, typescript)` relays Vue's `tsserver/request` notifications to the TypeScript server's `typescript.tsserverRequest` command and returns a `Disposable`. Attach it before the Vue session initializes. Open each `.vue` document in both sessions, TypeScript first.

The TypeScript server must advertise `workspace/executeCommand` and implement that command. The host supplies compatible server/plugin versions and initialization configuration; the bridge does not install them or configure a tsserver plugin by itself.

```ts
import { bridgeVueTypeScript, type LspSession } from '@adecore/lsp';

export async function initializeVuePair(vue: LspSession, typescript: LspSession) {
    const bridge = bridgeVueTypeScript(vue, typescript);
    try {
        await typescript.initialize();
        await vue.initialize();
        return bridge;
    } catch (error) {
        bridge.dispose();
        throw error;
    }
}
```

The caller owns both sessions and shuts them down on failure or project teardown. Dispose the bridge before dropping their transports. It understands both a plain request tuple and the outer positional array used by vscode-jsonrpc. On a TypeScript failure it reports the error and replies to Vue with a null body so the Vue request does not remain pending forever. A disposed bridge stops sending responses.

## Routing document features

`isVueExpression(text, offset)` detects script bodies, interpolations, and directive/attribute expressions using lexical matching. `vueServerOrder(method, text, params)` returns `['typescript', 'vue']` in those expressions and for inlay hints; elsewhere it returns `['vue', 'typescript']`. A host service chooses the first supporting server and uses the other as fallback.

This is a routing preference, not a full Vue parser or a result merger. Feed it current text and LSP params containing the intended position/range. A malformed position falls back to markup routing. Do not substitute the browser selection's visual column for its UTF-16 character.

Keep diagnostics from both servers with stable source ids. A `DiagnosticsReport` replaces only that source's prior report. Route resolve requests and commands back to the server that produced their item; provider preference alone cannot recover item ownership.

See the [Vue protocol tests](https://github.com/basmilius/adecore/blob/main/packages/lsp/src/vue.test.ts) for the relay and routing cases, and [host integration](./testing-host) for the responsibilities of a multi-server `LanguageService`.
