# ProvidersPane

A settings pane for the agent CLIs of a host and their accounts: a list on the left, the picked CLI or account on the right. It sits in the `SettingsDialog` of `@adecore/ui` and reads the host from its scope.

```tsx
import { ProvidersPane } from '@adecore/agents-react/providers';
```

<Demo src="agents/providers-pane" />

The list has three groups, each shown only when it has providers:

- Ready: an installed CLI with a signed-in account, or a provider without accounts.
- Needs setup: a provider `setupStatusOf` flags, or a CLI whose accounts are all signed out, failing or off.
- Not installed: a CLI the host reports with `installed: false`. Picking it opens its install page.

With several accounts, they sit under the provider with their plans, and the default one has a Default pill. A provider's detail shows its version, abilities, new-chat defaults and accounts. An account shows its state, name, color, folder and environment variables. The plus beside a provider adds an account, in a new folder or, under Advanced, an existing one.

Run `watchProviderAccounts(scopeId, transport)` for the scope; see [Getting started](/agents-react/guide/getting-started#a-scope). Sign in runs the CLI's login through the host's `openLogin`; without it there is no button. A provider with a `home` but no `loginCommand` signs in from its first chat instead. The host checks every save and may refuse it, such as a reserved variable.

## Props

| Prop            | Type                                                      |                                                                                                                                             |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `target`        | `string \| null`                                          | The `searchId` of a settings search result; the pane opens on its CLI. `providers.install.<kind>` opens a CLI's install page. |
| `detailOf`      | `(provider: ProviderInfo) => ReactNode \| null`           | A detail of your own for a CLI; `null` draws the usual one.                                                                                 |
| `defaults`      | `boolean`                                                 | Shows what a new chat starts with. `true` by default.                                                       |
| `installStepOf` | `(provider: ProviderInfo) => ProviderInstallStep \| null` | A step of your own on a CLI's install page, after its install.                                                     |
| `setupStatusOf` | `(provider: ProviderInfo) => ProviderSetupStatus \| null` | Puts a provider under Needs setup; `null` leaves it to its accounts.                                       |
| `sectionsOf`    | `(provider: ProviderInfo) => ReactNode \| null`           | Sections of your own under a CLI's usual detail, such as an update.                                        |
| `addPage`       | `(added: (kind: AgentKind) => void) => ReactNode`         | A page of your own to add a provider from, opened by an Add provider row.                                   |

## Setup status

A provider without a CLI login cannot report readiness through its accounts. Return a `ProviderSetupStatus` (`text` and a `tone` of `muted` or `warning`) while it cannot be used yet.

```tsx
<ProvidersPane setupStatusOf={(provider) => (provider.kind === 'example' && !example.enabled ? { text: 'Off', tone: 'muted' } : null)} />
```

## Install page

A CLI reported with `installed: false` and an `install` field (see [Providers](/agent-contracts/providers-and-accounts#providers)) gets numbered steps: install, sign in, start working.

The install step lists a command per system, opening on the scope machine's system from the host's `useMachinePlatform`. Each command has Copy. "Run in a terminal" needs the host's `runProviderCommand`, and the install guide link needs a `guideUrl`. The sign-in step names the provider's `signIn` ways and adds the host's `providerKeyNote` after an environment key. See [the host](/agents-react/guide/host).

Report the provider anew once installed and the page follows. When every step is done, the pane shows the usual detail. Without `install`, a short note replaces the steps.

`target="providers.install.<kind>"` opens the install page directly. An installed CLI opens on its detail instead.

```tsx
<ProvidersPane target="providers.install.example" />
```

A CLI that needs more, such as a server your app installs beside it, gets an extra step through `installStepOf`. Return a `ProviderInstallStep` with a `title`, `done` and a `body`. Sign-in waits until it is done.

```tsx
<ProvidersPane
    installStepOf={(provider) => (provider.kind === 'example' ? { title: 'Install the chat server', done: server.installed, body: <ServerInstall /> } : null)}
/>
```

## Adding a provider

`addPage` draws your own page to add a provider, such as a catalog. The list ends in an Add provider row, and `target="providers.add"` opens the page. Call `added(kind)` after the host reported the new provider, and the pane picks it.

```tsx
<ProvidersPane addPage={(added) => <Catalog onInstalled={added} />} />
```

## In the settings dialog

`settingsSection(section, Pane)` makes the dialog's entry. `PROVIDERS_SECTION` is this pane's section and `USAGE_SECTION` the one of [`UsagePane`](/agents-react/usage/usage-page#usagepane).

```tsx
import { SettingsDialog, useSettingsTarget } from '@adecore/ui/settings';
import { PROVIDERS_SECTION, settingsSection } from '@adecore/agents-react';

function ProvidersSettings() {
    const { target } = useSettingsTarget();
    return <ProvidersPane target={target} />;
}

<SettingsDialog groups={[{ label: null, sections: [settingsSection(PROVIDERS_SECTION, ProvidersSettings)] }]} {...dialogProps} />;
```

Keep the pane component the same between renders, or its forms start over.

## Parts and actions

The detail and its forms are internal. A refused save shows a toast through the host's `notify`. Removing an account keeps its folder; new chats fall back to the CLI's default account.

`accountsOfKind` and `accountStatusLine` read a CLI's accounts for a list of your own. `topAccountEntry` picks the account a start without one goes to: the first in the order that is on. `AccountRule` is the shape a host's `useAccountRule` answers with, per CLI the project's default and the accounts it turned off. `providerAbilities(provider)` describes where a CLI opens and whether it reports its status.
