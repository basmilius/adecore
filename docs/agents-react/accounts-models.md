# Accounts and models

Provider catalogs and accounts belong to a backend scope. `ChatClient` fills the catalog through `providerSinkFor(scopeId)`. Call `watchProviderAccounts(scopeId, transport)` once per scope and release its returned function when the runtime ends. The watcher reads `accounts.list` on open/reconnect and listens for `accounts.changed`.

## Loading and compatibility

`ProvidersRow` contains `providers` and `loaded`. `ProviderAccountsRow` contains `accounts` and `loaded`. `knownAccounts(row)` distinguishes undefined (not loaded), null (host supplies no account support), and a real map. A failed initial account request falls back to null for older hosts. An account event arriving after a list request supersedes that older list response.

Use `useProviders` and `useProviderAccounts` inside the scope, or `providersOf(scopeId)` and `providerAccountsOf(scopeId)` outside React. Forget their rows when the host is removed; detaching one chat should not erase the host catalog.

The UI offers catalog models and option descriptors from the backend. It does not detect installed CLIs, discover credentials, or maintain a separate browser model catalog. `providerAbilities` describes the backend-reported chat/terminal and hook capabilities.

## Provider settings

`ProvidersPane` renders a provider/account master-detail list. It accepts `target` for a settings search result, `detailOf(provider)` for a host-specific detail (null falls back to the ordinary detail), and `defaults` (default true). Pass false when another host screen controls new-chat defaults.

This complete settings composition receives an `openUsage` action and must live in a chat scope and `UIProvider`:

```tsx
import { createContext, useContext, useState } from 'react';
import { SettingsDialog, useSettingsTarget } from '@adecore/ui/settings';
import { ProvidersPane } from '@adecore/agents-react/providers/ProvidersPane';
import { PROVIDERS_SECTION, USAGE_SECTION, settingsSection } from '@adecore/agents-react/settings/sections';
import { UsagePane } from '@adecore/agents-react/usage/UsagePane';

const UsageNavigation = createContext<() => void>(() => {});

function ProviderSettingsPane() {
    const { target } = useSettingsTarget();
    return <ProvidersPane target={target} />;
}

function UsageSettingsPane() {
    return <UsagePane onOpenPage={useContext(UsageNavigation)} />;
}

export function AgentSettings({ open, onOpenChange, openUsage }: { open: boolean; onOpenChange(open: boolean): void; openUsage(): void }) {
    const [section, setSection] = useState('providers');
    const [target, setTarget] = useState<string | null>(null);
    return (
        <UsageNavigation.Provider value={openUsage}>
            <SettingsDialog
                open={open}
                onOpenChange={onOpenChange}
                section={section}
                onNavigate={(next) => {
                    setSection(next.section);
                    setTarget(next.target ?? null);
                }}
                target={target}
                onTargetShown={() => setTarget(null)}
                groups={[
                    {
                        label: null,
                        sections: [settingsSection(PROVIDERS_SECTION, ProviderSettingsPane), settingsSection(USAGE_SECTION, UsageSettingsPane)]
                    }
                ]}
            />
        </UsageNavigation.Provider>
    );
}
```

The pane components have stable identities so changing dialog state does not remount their forms. Build `settingsSection` entries when drawing so labels follow the current language. See [UI settings](/ui/settings/settings-dialog) for dialog search/navigation behavior.

`openLogin(scopeId, kind, accountId, name)` is a host-provided login launcher. Null offers none. `useLoginBlocked(scopeId)` returns a reason when login cannot start. The browser never launches a CLI. The host owns executable/environment filtering and desktop authorization.

## Save, link, and remove accounts

`createAccount(scope, kind, label, color)` requests a new host-owned account folder and returns its ID. `linkAccount(scope, id, account)` adds an existing host folder. `saveAccounts` sends the whole map and returns false with an error toast on refusal. `saveAccount` merges one entry with the last known map; it is not a conflict-free partial update protocol.

`removeAccount` forgets the account entry but retains its folder. A remembered new-chat selection for that account resets to the provider default after successful removal. The backend remains responsible for validating IDs, paths, variables, and enabled state. `AccountVariables`/`variables` edit the exported environment map; never use a browser account form as permission to inherit arbitrary process secrets.

## Remember provider-specific selections

`ChatPreferences.selectionByProvider` keeps a `ModelSelection` for each CLI. A slug only identifies a model within that provider. `lastProvider` sets the default for a chat without a fixed provider. `accountByMachine` uses the scope ID and provider; account IDs cannot be carried to a different backend just because the display names match.

`accountFor` falls back to the default if a loaded account is removed, disabled, or belongs to another provider. Before accounts are loaded, it preserves the pick. `startingSelection` uses the remembered selection first, then the provider's default model. See [persistence](./persistence) before reading those preferences.

`ModelOptionControl` draws boolean and choice descriptors. `optionValue` rejects a value that no longer fits the descriptor and uses its default. `carryOptions` retains only values the destination model also accepts:

```tsx
import type { ModelOptionDescriptor, ModelSelection } from '@adecore/agent-contracts';
import { ModelOptionControl } from '@adecore/agents-react/agents/ModelOptionControl';

export function OptionField({
    option,
    selection,
    onChange
}: {
    option: ModelOptionDescriptor;
    selection: ModelSelection;
    onChange(selection: ModelSelection): void;
}) {
    return (
        <ModelOptionControl
            option={option}
            options={selection.options}
            layout="row"
            onChange={(value) => onChange({ ...selection, options: { ...selection.options, [option.id]: value } })}
        />
    );
}
```

With `defaultLabel`, choice controls can report undefined to leave the choice to the model; boolean controls ignore that extra option. `modelName`, `useModelName`, and `shortModelName` format catalog names for display. They do not rewrite the backend selection.

Changing provider before the first message calls `ChatClient.retarget`, which kills/recreates the empty backend chat and drops its previous account and stream sequence. A populated chat uses its existing provider. Switching an account for continuation is a distinct `continueOn` action, subject to backend support and refusal.
