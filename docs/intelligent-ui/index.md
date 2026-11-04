# Intelligent UI

`@adecore/intelligent-ui` lets an agent answer with a block of components instead of prose: a summary, a table, a checklist, next steps to pick from. The package defines the catalog, compiles blocks out of a streaming reply and evaluates them in a bounded interpreter. It has no framework and no DOM, depends only on zod, and runs in Bun, Node and a browser. A renderer draws the result.

```ui
$selected = ["links"]
<Summary tone="warning" badge="2 findings">The review found two problems</Summary>
<Checklist value={$selected}>
<Item value="links"><File path="src/terminal/links.ts" line={148}>Cuts a path at a space</File></Item>
<Item value="preload"><File path="src/preload.ts" line={62}>Bridge method not optional</File></Item>
</Checklist>
<Choices>
<Choice primary={true} context={"Fix these findings: " + @Join($selected)}>Fix {@Count($selected)}</Choice>
<Choice>Leave it</Choice>
</Choices>
```

The agent writes this in a fenced code block. [`UiReply`](/agents-react/chat/intelligent-ui) draws it:

<Demo src="agents/intelligent-ui" />

## What it does

- Shows status, numbers, records and charts from the [catalog](/intelligent-ui/components/status).
- Keeps local state: a checklist, a switch, a slider, a segmented control and buttons that set or reset values.
- Computes text and props with a small [expression language](/intelligent-ui/language/expressions): arithmetic, comparisons, `@Count`, `@Filter`, `@Sum`, `@Join` and `@Round`.
- Reads [live data](/intelligent-ui/host/queries) from a source the host registered.
- Names a file, a diff, a commit or a node, which the host turns into a [link](/intelligent-ui/host/links).
- Offers follow-ups after finished work with [Choices](/intelligent-ui/host/choices). A question the turn waits on goes through the agent's question tool or prose.

A block cannot run code, fetch an address, style anything or act outside itself; see the [security model](/intelligent-ui/guide/security).

## How a block travels

1. The host tells the agent the language with [`uiSessionNote`](/intelligent-ui/getting-started#tell-the-agent).
2. The agent writes a fenced `ui` block in its reply.
3. The backend compiles the reply while it streams and stores the final blocks on the assistant item.
4. The page evaluates each block against its local state and draws the nodes.
5. A person changes inputs in the block. Nothing leaves the block until they pick a Choice, which sends one message back.
6. Live data and links go through the host, which checks every read and every target.

## What it leaves to the app

The package draws nothing and reads nothing. The app tells the agent the language, stores the compiled blocks, and decides what a block may reach: which sources a live query reads, which targets a link opens, and what a Choice sends. [`@adecore/agents`](/agents/chats#live-ui-sources) compiles the blocks in a chat session, and [`@adecore/agents-react`](/agents-react/chat/intelligent-ui) draws them.

## Where to next

- [Getting started](/intelligent-ui/getting-started) wires blocks end to end: the note, the compiler, the wire and the page.
- [Security model](/intelligent-ui/guide/security) covers what a block can and cannot do.
- [Syntax](/intelligent-ui/language/syntax), [Expressions](/intelligent-ui/language/expressions) and [State and inputs](/intelligent-ui/language/state) cover the language.
- [Status](/intelligent-ui/components/status), [Data](/intelligent-ui/components/data), [Structure](/intelligent-ui/components/structure), [Content](/intelligent-ui/components/content), [Places](/intelligent-ui/components/places), [Host links](/intelligent-ui/components/links), [Inputs](/intelligent-ui/components/inputs) and [Choices](/intelligent-ui/components/choices) cover the catalog.
- [Live queries](/intelligent-ui/host/queries), [Choices](/intelligent-ui/host/choices), [Links](/intelligent-ui/host/links) and [Compilation and streaming](/intelligent-ui/host/compilation) cover the host's side.
- [Reference](/intelligent-ui/reference) lists every export of every entry point.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/intelligent-ui/LICENSE).
