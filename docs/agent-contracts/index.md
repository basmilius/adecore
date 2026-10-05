# Agent contracts

`@adecore/agent-contracts` contains Zod schemas and TypeScript contracts for agent chats, providers, accounts, tasks, worktrees, and usage. A browser client and a Node or Bun host can import the same definitions. The package opens no connections, starts no processes, and makes no permission decisions.

Applications compose `AGENT_REQUEST_SCHEMAS` and `AGENT_EVENT_SCHEMAS` into their own protocol. The [agent hosts package](../agents/) implements the backend, and the [agent views package](../agents-react/) supplies the React client. The schemas also work with a transport and UI of your own.

## Read the guide

| Chapter                                                        | What it covers                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [Getting started](./getting-started)                           | Imports, local development, and a first payload check                  |
| [Frames and events](./frames-and-events)                       | Transport contracts, request groups, replies, and replay               |
| [Conversation content](./conversation)                         | Thread items, questions, tool approvals, attachments, and limits       |
| [Providers and accounts](./providers-and-accounts)             | Model selections, capabilities, runtime modes, and account records     |
| [Tasks and usage](./tasks-and-usage)                           | Durable task state, worktree metadata, token totals, and plan limits   |
| [Validation and compatibility](./validation-and-compatibility) | Schema errors, defaults, entrypoints, and persisted/wire compatibility |

## Package status

This workspace package is private at `0.0.0`, pending its first publication and Trusted Publishing setup. Use the local checkout for now. The `source` export condition selects TypeScript; default exports and `types` select compiled JavaScript and declarations. Build contracts before the backend and React packages.

The transferred code retains FSL-1.1-MIT. Read the [package license](https://github.com/basmilius/adecore/blob/main/packages/agent-contracts/LICENSE) for its terms.
