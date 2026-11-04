# Reference

Every name each entry point exports, types included, read from its source. Anything not listed is internal and may change in any release. The [source](https://github.com/basmilius/adecore/tree/main/packages/agent-contracts/src) documents every field.

The root exports every name of the subpaths below. A subpath holds one group, for an app that wants to import less.

## `@adecore/agent-contracts`

Everything below, from one import.

<ExportTable entry="@adecore/agent-contracts" />

## `@adecore/agent-contracts/envelope`

The frames: a request, a reply, an event and the error a reply carries. See [Protocol](/agent-contracts/protocol).

<ExportTable entry="@adecore/agent-contracts/envelope" />

## `@adecore/agent-contracts/port`

The shape of a connection that carries frames, types only. See [Getting started](/agent-contracts/getting-started#implement-a-port).

<ExportTable entry="@adecore/agent-contracts/port" />

## `@adecore/agent-contracts/protocol`

The table of every request and event with its schemas. See [Requests and events](/agent-contracts/requests).

<ExportTable entry="@adecore/agent-contracts/protocol" />

## `@adecore/agent-contracts/chat`

A chat, its items, events, attachments, requests, bookmarks and forks. See [Conversation](/agent-contracts/conversation) and [UI blocks in replies](/agent-contracts/ui-replies).

<ExportTable entry="@adecore/agent-contracts/chat" />

## `@adecore/agent-contracts/model`

Models, catalogs, selections, capabilities and runtime modes. See [Providers and models](/agent-contracts/providers).

<ExportTable entry="@adecore/agent-contracts/model" />

## `@adecore/agent-contracts/provider-accounts`

Account ids, records, variables, statuses and the account requests. See [Accounts](/agent-contracts/accounts).

<ExportTable entry="@adecore/agent-contracts/provider-accounts" />

## `@adecore/agent-contracts/agent`

Agent kinds, statuses, a terminal agent's info and its approvals. See [Providers and models](/agent-contracts/providers#agent-kinds).

<ExportTable entry="@adecore/agent-contracts/agent" />

## `@adecore/agent-contracts/task`

Tasks between chats. See [Tasks and worktrees](/agent-contracts/tasks).

<ExportTable entry="@adecore/agent-contracts/task" />

## `@adecore/agent-contracts/worktree`

Git worktree metadata and the work in one. See [Tasks and worktrees](/agent-contracts/tasks#worktrees).

<ExportTable entry="@adecore/agent-contracts/worktree" />

## `@adecore/agent-contracts/usage`

Token totals, usage summaries, prices and plan limits. See [Usage](/agent-contracts/usage).

<ExportTable entry="@adecore/agent-contracts/usage" />

## `@adecore/agent-contracts/visual`

A chat's visuals, the bridge to their page, its theme and its bootstrap. See [Visuals](/agent-contracts/visuals).

<ExportTable entry="@adecore/agent-contracts/visual" />

## `@adecore/agent-contracts/ids`

The id of a terminal session.

<ExportTable entry="@adecore/agent-contracts/ids" />

## `@adecore/agent-contracts/text`

Clipping text and keeping the tail of a tool's output. See [Conversation](/agent-contracts/conversation#items).

<ExportTable entry="@adecore/agent-contracts/text" />
