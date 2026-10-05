# Testing

`@adecore/lsp/testing` holds a language server for tests and the memory transport, so a session runs in `bun test` without a process, a network or an installed server.

```ts
import { expect, test } from 'bun:test';
import { LspSession, pathToFileUri } from '@adecore/lsp';
import { createMemoryTransportPair, FakeLanguageServer } from '@adecore/lsp/testing';

test('the server follows the document', async () => {
    const [client, serverEnd] = createMemoryTransportPair();
    const server = new FakeLanguageServer(serverEnd, {
        capabilities: { textDocumentSync: 2, hoverProvider: true },
        handlers: { 'textDocument/hover': () => ({ contents: { kind: 'plaintext', value: 'A value' } }) }
    });
    const session = new LspSession(client, { rootUri: pathToFileUri('/work') });

    await session.initialize();
    const document = session.openDocument({ uri: pathToFileUri('/work/example.ts'), languageId: 'typescript', text: 'const value = 1;' });

    expect(await document.hover({ line: 0, character: 6 })).not.toBeNull();
    await document.updateText('const value = 2;');
    expect(server.documents.get(document.uri)?.text).toBe('const value = 2;');

    await session.shutdown();
    expect(server.shutdownRequested).toBe(true);
});
```

`FakeLanguageServer` answers the handshake with its `capabilities` (`textDocumentSync: 2` by default), keeps the text of every open document the way a server does, and answers what `handlers` or `handle(method, handler)` registers. Anything else is refused as unsupported. A handler only answers; the capabilities must still declare the provider, since the session asks only what the server declares.

| Member                                     | What it does                                                    |
| ------------------------------------------ | --------------------------------------------------------------- |
| `received`, `paramsOf(method)`             | Every message that came in, and the params of one method        |
| `documents`                                | The open documents with their `text`, `version` and `languageId` |
| `publishDiagnostics(uri, diagnostics, version?)` | Sends diagnostics                                         |
| `notify(method, params?)`, `request(method, params?)` | Sends a notification or a request to the client       |
| `crash()`                                  | Closes the transport under the client                           |
| `shutdownRequested`, `exited`              | Whether the client shut it down                                 |
| `silent: true`                             | Never answers the handshake, like a server that hangs           |

For tests of editor features, [`FakeLanguageService`](/editor-react/testing) skips the protocol and implements `LanguageService` directly.
