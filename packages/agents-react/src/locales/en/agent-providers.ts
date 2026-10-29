export default {
    status: {
        checking: 'Checking',
        disabled: 'Off',
        notFound: 'CLI not found',
        signedOut: 'Not logged in',
        ready: 'Logged in',
        readyPlan: 'Logged in · {{plan}}',
        available: 'Ready',
        folderMissing: 'Folder missing',
        unavailable: 'Not available',
        failed: 'Check failed'
    },
    failed: 'Could not show the provider settings',
    list: {
        label: 'Agents and their accounts',
        default: 'Default',
        ready: 'Ready',
        needsSetup: 'Needs setup',
        signedOut: 'Not logged in',
        addAccount: 'Add {{provider}} account',
        addProvider: 'Add provider',
        notInstalled: 'Not installed',
        missing: 'Missing',
        notInstalledNote: 'Install to use it here.',
        none: 'No agents found on this machine.',
        noAccounts: 'Update Ruimte on this machine to add accounts.'
    },
    install: {
        notInstalled: 'Not installed',
        steps: 'Set up {{provider}}',
        platform: 'System',
        platforms: {
            darwin: 'macOS',
            linux: 'Linux',
            win32: 'Windows'
        },
        copy: 'Copy',
        copied: 'Copied',
        run: 'Run in a terminal',
        guide: 'Install guide',
        install: {
            title: 'Install the CLI',
            none: 'No install command for this system.',
            done: 'Installed, version {{version}}.',
            doneNoVersion: 'Installed.'
        },
        signIn: {
            title: 'Log in',
            command: 'Run this in a terminal:',
            env: 'Set <code>{{variable}}</code> in the environment the CLI starts in.',
            chat: 'The first chat asks you to log in.',
            or: 'Or',
            unknown: 'Asks you to log in the first time it runs.'
        },
        start: {
            title: 'Start working',
            description: 'Pick {{provider}} for your next chat or terminal.'
        },
        footer: {
            missing: 'Not found yet. Ruimte checks again when you come back to this window.',
            found: 'Found on this machine.'
        },
        fallback: 'Install {{provider}} to use it here.'
    },
    abilities: {
        version: 'Version {{version}}.',
        chatAndTerminal: 'Chat and terminal.',
        terminalOnly: 'Terminal only.',
        reportsStatus: 'Shows when it needs you.',
        noStatus: 'Does not show when it needs you.'
    },
    cli: {
        addAccount: 'Add account',
        onlyDefault: '{{provider}} supports only its default account.',
        defaults: {
            title: 'Defaults for new chats',
            description: 'Picking a model in a chat also changes its default here.',
            descriptionWithAccount: 'Picking a model or account in a chat also changes its default here.',
            account: 'Account',
            accountFor: 'Default account for {{provider}}',
            model: 'Model',
            modelFor: 'Default model for {{provider}}',
            shared: 'Shared by every {{provider}} account.',
            usesCliDefault: "Uses the CLI's own default model.",
            providerDefault: 'Provider default',
            legacyModel: '{{name}} (legacy)'
        },
        accounts: 'Accounts',
        accountsOrder: 'New chats and agents start on the top account that is on.',
        defaultTag: 'Default',
        reorderHandle: 'Move {{account}}. Alt+Up and Alt+Down move it too.'
    },
    account: {
        kind: '{{provider}} account',
        enabled: {
            label: 'Use this account',
            description: 'When off, hidden from new chats and agents.'
        },
        showFolder: 'Show folder',
        folderCopied: 'Folder path copied',
        name: 'Name',
        color: 'Color',
        login: {
            title: 'Login',
            signedInAs: 'Logged in as {{email}}',
            signedIn: 'Logged in',
            planDetail: '{{plan}} plan. Log in again opens a terminal.',
            detail: 'Log in again opens a terminal.',
            signedOut: 'Not logged in',
            signedOutDetail: 'Opens a terminal where you log in to this account.',
            logIn: 'Log in',
            logInAgain: 'Log in again',
            inChat: 'Logs in from a chat',
            inChatDetail: 'The first chat on this account asks you to log in.'
        },
        folder: {
            label: 'Folder',
            detail: 'Given to the CLI as <code>{{variable}}</code>. The CLI keeps its own login, settings and history here.',
            detailPlain: 'The CLI keeps its own login, settings and history here.'
        },
        variables: {
            title: 'Variables',
            description: 'Extra environment for this account. Secrets stay in the keychain.',
            add: 'Add variable',
            name: 'Name of variable {{index}}',
            value: 'Value of {{name}}',
            kept: 'Kept in the keychain',
            lock: 'Keep {{name}} in the keychain',
            unlock: 'Store {{name}} as plain text',
            noKeychain: 'No keychain on this machine, so values stay plain text.',
            remove: 'Remove {{name}}',
            none: 'No variables',
            discard: 'Discard',
            problem: {
                noName: 'Every variable needs a name.',
                invalidName: '{{name}} is not a variable name.',
                duplicate: '{{name}} is set twice.',
                noValue: '{{name}} needs a value.'
            }
        },
        remove: {
            label: 'Remove account',
            description: 'Chats that use it ask for another account on their next turn. The folder stays on disk.',
            defaultNote: 'The default account cannot be removed. Turn it off above instead.',
            button: 'Remove',
            confirmTitle: 'Remove {{account}}?',
            confirmDescription: 'Its folder and login stay at {{folder}}.',
            confirm: 'Remove account'
        },
        saveFailed: 'Could not save the account',
        reorderFailed: 'Could not change the order of the accounts'
    },
    add: {
        title: 'Add {{provider}} account',
        description: 'Creates a folder, then opens a terminal to log in.',
        chatDescription: 'Creates a folder. The first chat asks you to log in.',
        name: 'Name',
        namePlaceholder: 'Work',
        color: 'Color',
        advanced: 'Advanced',
        link: {
            label: 'Link an existing folder',
            description: 'Use an existing config folder. Ruimte never moves or deletes it.',
            placeholder: 'Path on the machine'
        },
        create: 'Add account',
        linkButton: 'Link folder',
        failed: 'Could not add the account'
    },
    section: {
        label: 'Providers',
        description: 'Agents on this machine and their accounts.'
    },
    notAnswering: 'The machine is not answering. Try again once it is back.',
    common: {
        save: 'Save',
        cancel: 'Cancel'
    }
};
