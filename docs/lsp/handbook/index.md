# Language services and sessions

`@adecore/lsp` provides a DOM-free LSP 3.17 client and the `LanguageService` interface used by editor features. It does not import Node or Bun process APIs or launch a language server. A host supplies a transport, process policy, configuration, and authorized file operations.

Use `LspSession` for one conversation with one server. Use `LanguageService` as the contract between editor features and a host that may route several servers or a remote connection. `LspSession` is not itself a `LanguageService`; their document ownership and method signatures differ.

The package is private at `0.0.0` pending publication. Its root exports the client classes, transports, protocol types, edit/URI/file-filter helpers, and Vue bridge. `/testing` exports `FakeLanguageServer` and `createMemoryTransportPair`. Local development selects `source`; compiled/default imports and declarations come from `dist` after the package build.

## A complete in-memory conversation

```ts
import { LspSession, pathToFileUri } from '@adecore/lsp';
import { createMemoryTransportPair, FakeLanguageServer } from '@adecore/lsp/testing';

const [clientTransport, serverTransport] = createMemoryTransportPair();
const server = new FakeLanguageServer(serverTransport, {
    capabilities: { textDocumentSync: 2, hoverProvider: true },
    handlers: {
        'textDocument/hover': () => ({ contents: { kind: 'plaintext', value: 'A value' } })
    }
});
const session = new LspSession(clientTransport, {
    rootUri: pathToFileUri('/work'),
    clientInfo: { name: 'example-editor' },
    timeoutMs: 1_000
});

try {
    await session.initialize();
    const document = session.openDocument({
        uri: pathToFileUri('/work/example.ts'),
        languageId: 'typescript',
        text: 'const value = 1;'
    });
    await document.ready;
    const hover = await document.hover({ line: 0, character: 6 });
    console.assert(hover !== null);
    await document.updateText('const value = 2;');
    console.assert(server.documents.get(document.uri)?.text === document.text);
    await document.close();
} finally {
    await session.shutdown();
}
```

The fake answers JSON-RPC in memory and starts no process. Its capabilities must advertise the methods used by the client, and its handlers supply their answers. Register both; a handler alone does not make a feature available to a capability-aware client.

Continue with [transports and host processes](./transports), [initialization and capabilities](./initialization), [documents and edits](./documents-edits), [requests and language results](./requests-features), [Vue coordination](./vue), and [testing and host integration](./testing-host).
