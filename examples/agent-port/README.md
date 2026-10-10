# Agent port example

Runs a chat through `AgentHost`, `FramePort`, `ChatTransport`, `ChatClient` and `ChatScope`. The provider runs in the same process and its detection is injected, so no provider CLI needs to be installed. It waits for protocol events, never for a timer. It also loads a locale and renders a component that reads the scope, without a DOM.

After `bun install`, run `bun run --cwd examples/agent-port test` against the source exports. To try the compiled exports under Node, build the packages and run `bun run --cwd examples/agent-port test:dist`.
