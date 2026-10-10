# @adecore/intelligent-ui

[![npm](https://img.shields.io/npm/v/@adecore/intelligent-ui)](https://www.npmjs.com/package/@adecore/intelligent-ui)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev/intelligent-ui/)

Lets an agent answer with a block of components instead of prose: a summary, a table, a checklist, the next steps a person picks from. The package holds the catalog, a compiler that reads blocks out of a reply while it streams, and a bounded interpreter for their state and expressions. No framework and no DOM: a renderer draws what it returns. A block cannot run code, load an address or act outside itself.

**[Documentation](https://adecore.dev/intelligent-ui/)**

## Install

```sh
bun add @adecore/intelligent-ui
```

## Use

```ts
import { compileUi, evaluateUiBlock, uiSessionNote, UiState } from '@adecore/intelligent-ui';

const instructions = uiSessionNote(); // tell the agent the language

const blocks = compileUi(replyText, { id: replyId, final: true });
for (const block of blocks) {
    const state = new UiState(block);
    render(evaluateUiBlock(block, state).nodes);
}
```

`@adecore/agents` compiles the blocks of a chat session, and `@adecore/agents-react` draws them with live data, links and choices.

## Documentation

| Page | What it covers |
|---|---|
| [Getting started](https://adecore.dev/intelligent-ui/guide/getting-started) | Instructions, compilation, the wire and rendering |
| [Security model](https://adecore.dev/intelligent-ui/guide/security) | What a block can and cannot do |
| [Syntax](https://adecore.dev/intelligent-ui/language/syntax) | The language an agent writes |
| [Components](https://adecore.dev/intelligent-ui/components/status) | Every component and its props |
| [Live queries](https://adecore.dev/intelligent-ui/host/queries) | Data a host reads for a block |

## License

FSL-1.1-MIT, see [LICENSE](./LICENSE).
