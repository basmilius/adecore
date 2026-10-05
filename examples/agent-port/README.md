# Agent port example

Runs a chat through `AgentHost`, `FramePort`, `ChatTransport`, `ChatClient` and `ChatScope`. The provider runs in process and detection is injected. It uses no installed provider CLI and waits for protocol events rather than a timer.

After workspace installation, run `bun run --cwd examples/agent-port test` for source exports. Build the packages, then run `bun run --cwd examples/agent-port test:dist` for compiled exports under Node. The example also loads a locale and renders a scope consumer without a DOM.
