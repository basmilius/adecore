# Model picker

Which model answers and how. The composer draws all of this behind one pill. `ModelPicker` and `ModelOptionControl` are for a form outside a chat, such as new-chat defaults.

```tsx
import { ModelPicker } from '@adecore/agents-react/chat/ui';
import { ModelOptionControl } from '@adecore/agents-react/providers';
```

<Demo src="agents/model-picker" />

## ModelPicker

A trigger with the CLI's mark and the model's short name, and a popup with search, a group per CLI and legacy models behind an expander. Pass several CLIs to let a new chat pick its CLI; with one, the group headers go.

| Prop           | Type                                           |                                                                                  |
| -------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `providers`    | `ProviderInfo[]`                               | Whose models may be picked.                                                      |
| `provider`     | `AgentKind`                                    | The CLI of the current selection.                                                |
| `selection`    | `ModelSelection`                               |                                                                                  |
| `open`, `onOpenChange` |                                        | Controlled, so a command can open the same popup.                                |
| `onChange`     | `(provider: AgentKind, model: string) => void` |                                                                                  |
| `kbd`          | `string \| null`                               | The command named in the tooltip, `/model` by default; `null` outside a chat.     |
| `side`         | `'top' \| 'bottom'`                            | Where the popup opens. `top` by default.                                         |
| `trigger`      | `'plain' \| 'chip'`                            | `chip` names the CLI beside the model on a ground of its own, for a form.         |
| `finalFocus`   | `RefObject<HTMLElement \| null>`               | Where the focus goes when the popup closes.                                      |
| `footer`       | `ReactNode`                                    | A note under the list.                                                           |

### A model the CLI is too old for

A provider with many models shows the picked one and the default, and a "Models (n)" row that opens the rest. Search covers every model. Entries with a `vendor` group by it. A long list in the pill opens with a focused search field, and Enter picks the first hit. An entry with `tools: true` gets a wrench.

A star beside a model adds it to the person's favorites, which come first in their CLI's list. Favorites live per CLI in browser storage and never reach a host.

A model whose catalog entry has `minCliVersion` cannot be picked while the CLI is older. Its row reads "Requires Claude Code 2.1 or later on &lt;machine&gt;", with a button to the provider settings, and the host names the machine with `useMachineLabel`. A chat that reported the model running lifts the requirement. `pickerEntriesOf(providers, query, legacyOpen, expanded, current, favoritesOf)` builds the rows, each a `PickerEntry`.

## ModelOptionControl

One of a model's options, such as effort, drawn from its `ModelOptionDescriptor`: a `Switch` for a boolean, a `Segmented` for up to three choices in the `row` layout, a `Select` otherwise. It reads `options[option.id]` and calls `onChange` with the new value. `defaultLabel` adds an item that leaves the choice to the model, as `undefined`.

`carryOptions(options, model)` keeps the options the next model also offers, for a switch between models.

## Names

`modelName(slug, models)` returns a model's name from the catalog, or derives one from the slug. `useModelName(provider, slug)` reads the scope's CLIs. `shortModelName(name, models)` drops the prefix a CLI's models share. `agentChipOf` and `modelNameFromSlug` are the parts.

## Run settings and accounts

The composer's pill shows the model, its options, the permission mode, the context with its breakdown, compacting, and the account when there are several. `RUNTIME_MODES`, `runtimeModeLabel(mode)` and `runtimeModeHint(mode)` name the modes.

`useAccountChoice(kind, account, chatId)` returns the accounts a chat may pick, or `null` while the CLI has one. It keeps the chat's own account listed even when turned off, and leaves out what the host's `useAccountRule` turns off. For a chat that does not exist yet, `useNewAccountChoice(kind, rule?)` returns `loading`, `unsupported` (the machine keeps no accounts for the CLI) or `ready` with the enabled accounts in `offered`, plus `projectDefault`, `providerName` and `nameOf`. Accounts come in the person's order (`orderedAccountIds`); a start that names none goes to the top account that is on. Against a host that does not answer `accounts.reorder`, `accountFor` still reads the account picked per CLI and host. `startingSelection` and the other preference helpers in `@adecore/agents-react/chat` read the remembered model per CLI.
