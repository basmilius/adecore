# Getting started

The server on this page runs as a child process of a Bun or Node backend.

## Install

```sh
bun add @adecore/lsp
```

The package has no peer dependencies. Install the language server itself the way the app installs other tools; this page uses `typescript-language-server`.

## Connect a transport

A transport carries whole JSON-RPC messages. For a process, wrap its streams in a `ByteStream` and let `createStreamTransport` do the `Content-Length` framing:

```ts
import { spawn } from 'node:child_process';
import { createStreamTransport, type ByteStream } from '@adecore/lsp';

const child = spawn('typescript-language-server', ['--stdio'], { cwd: '/work' });

const stream: ByteStream = {
    write: (chunk) => void child.stdin.write(chunk),
    onData: (listener) => {
        child.stdout.on('data', listener);
        return { dispose: () => child.stdout.off('data', listener) };
    },
    onClose: (listener) => {
        const exited = (): void => listener();
        child.once('exit', exited);
        return { dispose: () => child.off('exit', exited) };
    },
    close: () => void child.kill()
};

const transport = createStreamTransport(stream);
child.stderr.on('data', (chunk) => console.error(String(chunk)));
```

Keep stderr apart from stdout, since a log line in stdout breaks the framing. [Transports](/lsp/transports) covers the WebSocket transport for a server on another machine.

## Start a session

An `LspSession` is one conversation with one server. Await `initialize()` before anything else.

```ts
import { LspSession, pathToFileUri } from '@adecore/lsp';

const session = new LspSession(transport, {
    rootUri: pathToFileUri('/work'),
    snippetSupport: true,
    onLog: (params) => console.log(params.message)
});

await session.initialize();
```

[Sessions](/lsp/sessions) lists every option, such as the settings the server reads.

## Open a document and ask

`openDocument` sends `didOpen` and returns the `LspDocument` that owns the text and version from then on. Each request is a method on it, with zero-based lines and UTF-16 characters.

```ts
const document = session.openDocument({
    uri: pathToFileUri('/work/src/example.ts'),
    languageId: 'typescript',
    text: 'const greeting = "hello";\n'
});

const hover = await document.hover({ line: 0, character: 6 });

await document.updateText('const greeting = "hello, world";\n');
```

`updateText` sends only the range that changed. A change cancels the requests still running, and an answer that arrives for the old text rejects with a `StaleResultError`. Drop it and ask again. [Documents and requests](/lsp/documents) lists the requests.

## Hand a language service to the editor

[`@adecore/editor-react`](/editor-react/getting-started) does not take a session. It takes a `LanguageService`, which can route a document to several servers, start them on demand or reach another machine. Over one session, each method forwards to the open document:

```ts
import type { DiagnosticsReport, LanguageDocument, LanguageRequestOptions, LanguageService, LspSession } from '@adecore/lsp';

const requestOptions = (options?: LanguageRequestOptions) => ({ signal: options?.signal, cancelPrevious: options?.parallel !== true });

class SessionService implements LanguageService {
    readonly #session: LspSession;
    readonly #open = new Set<string>();

    constructor(session: LspSession) {
        this.#session = session;
    }

    async openDocument({ uri, languageId, text }: LanguageDocument): Promise<void> {
        this.#open.add(uri);
        const open = this.#session.getDocument(uri);

        if (open !== undefined) {
            await open.updateText(text);
            return;
        }

        await this.#session.openDocument({ uri, languageId, text }).ready;
    }

    changeDocument(uri: string, changes: Parameters<LanguageService['changeDocument']>[1]): Promise<void> {
        return this.#document(uri).applyChanges(changes);
    }

    closeDocument(uri: string): Promise<void> {
        this.#open.delete(uri);
        return this.#document(uri).close();
    }

    supports(method: string, uri: string): boolean {
        const document = this.#session.getDocument(uri);
        return document !== undefined && this.#session.supports(method, document);
    }

    providerOptions(method: string, uri: string) {
        const document = this.#session.getDocument(uri);
        return document === undefined ? undefined : this.#session.providerOptions(method, document);
    }

    onProvidersChanged(listener: (uri: string) => void) {
        return this.#session.onCapabilitiesChanged(() => this.#open.forEach(listener));
    }

    onDiagnostics(listener: (report: DiagnosticsReport) => void) {
        return this.#session.onDiagnostics(({ uri, version, diagnostics }) => listener({ uri, version, diagnostics, source: 'typescript' }));
    }

    hover(uri: string, position: Parameters<LanguageService['hover']>[1], options?: LanguageRequestOptions) {
        return this.#document(uri).hover(position, requestOptions(options));
    }

    // completion, definition, rename and the other request methods forward the same way.

    #document(uri: string) {
        const document = this.#session.getDocument(uri);

        if (document === undefined) {
            throw new Error(`${uri} is not open.`);
        }

        return document;
    }
}
```

The comment stands for the rest of the requests; TypeScript lists the ones a class still lacks. `parallel` maps to `cancelPrevious: false`, so a feature that asks many questions at once does not cancel itself. [Language service](/lsp/language-service) lists what a service promises, such as rejecting answers for old text.

When the session runs in a backend and the editor in a page, the service in the page forwards these calls over the app's own IPC, and the backend runs the class above.

The editor side then takes the service:

```tsx
import { EditorView, ProjectLanguage } from '@adecore/editor-react';

const project = new ProjectLanguage(new SessionService(session), { folder: '/work' });

<EditorView engine={engine} options={options} project={project} uri={pathToFileUri('/work/src/example.ts')} languageId="typescript" className="h-96" />;
```

## Shut down

`shutdown()` closes the documents, sends `shutdown` and `exit` and closes the connection. Stopping the process stays with the app.

```ts
await session.shutdown();
child.kill();
```

## Checklist

- Stdout carries only protocol messages; stderr goes to a log.
- `initialize()` has resolved before the first document opens.
- URIs come from `pathToFileUri`, spelled the same way everywhere.
- A `StaleResultError` is dropped, not shown.
- The session shuts down before the process stops, and a closed session is replaced, never restarted.
