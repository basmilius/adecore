export default {
    status: {
        checking: 'Controleren',
        disabled: 'Uit',
        notFound: 'CLI niet gevonden',
        signedOut: 'Niet ingelogd',
        ready: 'Ingelogd',
        readyPlan: 'Ingelogd · {{plan}}',
        available: 'Klaar',
        folderMissing: 'Map ontbreekt',
        unavailable: 'Niet beschikbaar',
        failed: 'Controle mislukt'
    },
    failed: 'Kon de providerinstellingen niet tonen',
    list: {
        label: 'Agents en hun accounts',
        default: 'Standaard',
        ready: 'Klaar',
        needsSetup: 'Nog instellen',
        signedOut: 'Niet ingelogd',
        addAccount: '{{provider}}-account toevoegen',
        addProvider: 'Provider toevoegen',
        notInstalled: 'Niet geïnstalleerd',
        missing: 'Ontbreekt',
        notInstalledNote: 'Installeer om hem hier te gebruiken.',
        none: 'Geen agents gevonden op deze machine.',
        noAccounts: 'Werk Ruimte op deze machine bij om accounts toe te voegen.'
    },
    install: {
        notInstalled: 'Niet geïnstalleerd',
        steps: '{{provider}} instellen',
        platform: 'Systeem',
        platforms: {
            darwin: 'macOS',
            linux: 'Linux',
            win32: 'Windows'
        },
        copy: 'Kopiëren',
        copied: 'Gekopieerd',
        run: 'In een terminal uitvoeren',
        guide: 'Installatiegids',
        install: {
            title: 'Installeer de CLI',
            none: 'Geen installatiecommando voor dit systeem.',
            done: 'Geïnstalleerd, versie {{version}}.',
            doneNoVersion: 'Geïnstalleerd.'
        },
        signIn: {
            title: 'Log in',
            command: 'Voer dit uit in een terminal:',
            env: 'Zet <code>{{variable}}</code> in de omgeving waarin de CLI start.',
            chat: 'De eerste chat vraagt je om in te loggen.',
            or: 'Of',
            unknown: 'Vraagt bij de eerste start om in te loggen.'
        },
        start: {
            title: 'Aan de slag',
            description: 'Kies {{provider}} voor je volgende chat of terminal.'
        },
        footer: {
            missing: 'Nog niet gevonden. Ruimte kijkt opnieuw als je terugkomt in dit venster.',
            found: 'Gevonden op deze machine.'
        },
        fallback: 'Installeer {{provider}} om hem hier te gebruiken.'
    },
    abilities: {
        version: 'Versie {{version}}.',
        chatAndTerminal: 'Chat en terminal.',
        terminalOnly: 'Alleen terminal.',
        reportsStatus: 'Laat zien wanneer hij je nodig heeft.',
        noStatus: 'Laat niet zien wanneer hij je nodig heeft.'
    },
    cli: {
        addAccount: 'Account toevoegen',
        onlyDefault: '{{provider}} kent alleen zijn standaardaccount.',
        defaults: {
            title: 'Standaarden voor nieuwe chats',
            description: 'Een model kiezen in een chat verandert hier ook de standaard.',
            descriptionWithAccount: 'Een model of account kiezen in een chat verandert hier ook de standaard.',
            account: 'Account',
            accountFor: 'Standaardaccount voor {{provider}}',
            model: 'Model',
            modelFor: 'Standaardmodel voor {{provider}}',
            shared: 'Gedeeld door elk {{provider}}-account.',
            usesCliDefault: 'Gebruikt het standaardmodel van de CLI zelf.',
            providerDefault: 'Standaard van de provider',
            legacyModel: '{{name}} (legacy)'
        },
        accounts: 'Accounts',
        accountsOrder: 'Nieuwe chats en agents starten op het bovenste account dat aanstaat.',
        defaultTag: 'Standaard',
        reorderHandle: 'Verplaats {{account}}. Alt+Omhoog en Alt+Omlaag verplaatsen het ook.'
    },
    account: {
        kind: '{{provider}}-account',
        enabled: {
            label: 'Dit account gebruiken',
            description: 'Staat het uit, dan zien nieuwe chats en agents het niet.'
        },
        showFolder: 'Map tonen',
        folderCopied: 'Pad van de map gekopieerd',
        name: 'Naam',
        color: 'Kleur',
        login: {
            title: 'Login',
            signedInAs: 'Ingelogd als {{email}}',
            signedIn: 'Ingelogd',
            planDetail: '{{plan}}-abonnement. Opnieuw inloggen opent een terminal.',
            detail: 'Opnieuw inloggen opent een terminal.',
            signedOut: 'Niet ingelogd',
            signedOutDetail: 'Opent een terminal waarin je inlogt op dit account.',
            logIn: 'Inloggen',
            logInAgain: 'Opnieuw inloggen',
            inChat: 'Logt in vanuit een chat',
            inChatDetail: 'De eerste chat op dit account vraagt je in te loggen.'
        },
        folder: {
            label: 'Map',
            detail: 'Aan de CLI gegeven als <code>{{variable}}</code>. De CLI bewaart hier zijn eigen login, instellingen en geschiedenis.',
            detailPlain: 'De CLI bewaart hier zijn eigen login, instellingen en geschiedenis.'
        },
        variables: {
            title: 'Variabelen',
            description: 'Extra omgeving voor dit account. Geheimen blijven in de sleutelhanger.',
            add: 'Variabele toevoegen',
            name: 'Naam van variabele {{index}}',
            value: 'Waarde van {{name}}',
            kept: 'Bewaard in de sleutelhanger',
            lock: '{{name}} in de sleutelhanger bewaren',
            unlock: '{{name}} als platte tekst bewaren',
            noKeychain: 'Geen sleutelhanger op deze machine, dus waarden blijven leesbaar.',
            remove: '{{name}} verwijderen',
            none: 'Geen variabelen',
            discard: 'Weggooien',
            problem: {
                noName: 'Elke variabele heeft een naam nodig.',
                invalidName: '{{name}} is geen naam voor een variabele.',
                duplicate: '{{name}} staat er twee keer in.',
                noValue: '{{name}} heeft een waarde nodig.'
            }
        },
        remove: {
            label: 'Account verwijderen',
            description: 'Chats die het gebruiken vragen bij hun volgende turn om een ander account. De map blijft op de schijf.',
            defaultNote: 'Het standaardaccount kan niet weg. Zet het hierboven uit.',
            button: 'Verwijderen',
            confirmTitle: '{{account}} verwijderen?',
            confirmDescription: 'De map en de login blijven in {{folder}}.',
            confirm: 'Account verwijderen'
        },
        saveFailed: 'Kon het account niet opslaan',
        reorderFailed: 'Kon de volgorde van de accounts niet wijzigen'
    },
    add: {
        title: '{{provider}}-account toevoegen',
        description: 'Maakt een map en opent een terminal om in te loggen.',
        chatDescription: 'Maakt een map. De eerste chat vraagt je in te loggen.',
        name: 'Naam',
        namePlaceholder: 'Werk',
        color: 'Kleur',
        advanced: 'Geavanceerd',
        link: {
            label: 'Een bestaande map koppelen',
            description: 'Gebruik een bestaande configuratiemap. Ruimte verplaatst of verwijdert hem nooit.',
            placeholder: 'Pad op de machine'
        },
        create: 'Account toevoegen',
        linkButton: 'Map koppelen',
        failed: 'Kon het account niet toevoegen'
    },
    section: {
        label: 'Providers',
        description: 'Agents op deze machine en hun accounts.'
    },
    notAnswering: 'De machine geeft geen antwoord. Probeer het opnieuw zodra hij terug is.',
    common: {
        save: 'Opslaan',
        cancel: 'Annuleren'
    }
};
