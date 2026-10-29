export default {
    transport: {
        notConnected: 'De agents zijn niet bereikbaar',
        closedBeforeAnswer: 'De verbinding met de agents sloot voordat ze antwoordden',
        badReply: 'Kon het antwoord van de machine niet lezen',
        notSent: 'Kon de agents niet bereiken. Probeer het opnieuw.'
    },
    attachments: {
        rejected: {
            empty: 'Leeg bestand',
            tooLarge: 'Groter dan {{size}}',
            tooMany_one: 'Hoogstens {{count}} bestand per bericht',
            tooMany_other: 'Hoogstens {{count}} bestanden per bericht',
            tooHeavy: 'Hoogstens {{size}} in totaal per bericht'
        },
        unreadable: 'Kon {{name}} niet lezen',
        unreadableThumbnail: 'Kon de miniatuur niet lezen'
    },
    references: {
        gone: 'Niet in dit project',
        untitled: 'Naamloos'
    },
    fork: {
        refusal: {
            notInConversation: 'Deze turn zit niet in het gesprek',
            cliCannotFork: 'Deze agent kan zijn gesprek niet forken',
            noConversation: 'Nog niets om te forken. Stuur eerst een bericht.',
            turnRunning: 'Wacht tot de turn klaar is',
            originalGone: 'Origineel niet meer in dit project'
        },
        point: {
            afterLast: 'Na de laatste turn',
            afterThis: 'Na deze turn',
            afterTurn: 'Na turn {{number}} van {{total}}',
            about: '{{where}}: "{{prompt}}"'
        },
        branch: {
            unnamed: 'Geef de branch een naam',
            taken: 'Naam al in gebruik'
        },
        pill: {
            label: 'Fork'
        }
    },
    resumeCompaction: {
        title: 'Hervatten met minder context',
        carried: '{{tokens}} tokens van eerder',
        keep: 'Hele geschiedenis houden',
        compact: 'Comprimeren',
        cacheExpired: {
            title: 'Cache verlopen',
            carried: 'Het volgende bericht kost {{tokens}} tokens tegen de volle prijs'
        }
    },
    goal: {
        status: {
            active: 'Werkt aan een doel',
            paused: 'Doel gepauzeerd',
            blocked: 'Doel geblokkeerd',
            'usage-limited': 'Doel gestopt op een gebruikslimiet',
            'budget-limited': 'Doel heeft zijn tokenbudget op',
            complete: 'Doel bereikt'
        },
        pill: 'Doel',
        checks_one: '{{count}} controle nog niet gehaald',
        checks_other: '{{count}} controles nog niet gehaald',
        tokens: '{{tokens}} tokens',
        budget: '{{tokens}} van {{budget}} tokens',
        lastCheck: 'Laatste controle: {{check}}',
        pause: 'Pauzeren',
        resume: 'Hervatten',
        clear: 'Wissen',
        failed: 'Kon het doel niet wijzigen'
    },
    limit: {
        usage: {
            pill: 'Limiet bereikt',
            pillUntil: 'Limiet tot {{time}}',
            pillResumes: 'Verder om {{time}}',
            title: 'Gestopt op een verbruikslimiet',
            resets: 'De limiet reset om {{time}}.',
            resumes: 'Gaat verder om {{time}}.'
        },
        overload: {
            pill: 'Overbelast',
            pillRetry: 'Opnieuw om {{time}}',
            title: 'Model overbelast',
            sendAgain: 'Stuur een bericht om het opnieuw te proberen.',
            retries: 'Probeert opnieuw om {{time}}.'
        },
        toggle: 'Verder na reset',
        machineOff: 'Uitgezet voor deze machine. Zet het aan in Instellingen, Agents.',
        continueOn: 'Verder op',
        continueOnAria: 'Verder op {{account}}',
        continueOnTip: 'Wisselt naar {{account}}, dat de meeste ruimte over heeft, en verstuurt de turn opnieuw.',
        continueFailed: 'Kon niet verder op {{account}}',
        chooseAccount: 'Kies een ander account',
        continueInForkAria: 'Verder op {{account}} in een fork',
        inFork: 'in een fork'
    },
    contextMeter: {
        aria: '{{percent}}% van de context gebruikt',
        title: 'Context',
        of: '{{used}} van {{window}}',
        used: '{{tokens}} gebruikt',
        percentUsed: '{{percent}} gebruikt',
        estimate: '≈{{tokens}}',
        parts: {
            toolOutput: 'Tool-output',
            filesRead: 'Gelezen bestanden',
            conversation: 'Gesprek',
            system: 'Systeem'
        },
        compactNow: 'Nu comprimeren'
    },
    rows: {
        user: {
            heading: 'Jij',
            showAll: 'Alles tonen',
            showLess: 'Minder tonen',
            quoteGone: 'Geciteerd antwoord staat niet meer in deze chat.'
        },
        message: {
            heading: 'Bericht van {{name}}',
            unnamed: 'een andere node'
        },
        report: {
            heading: 'Rapport'
        },
        reply: {
            agent: 'Agent',
            writing: 'Schrijft…'
        },
        thinking: {
            live: 'Denkt na…',
            thoughtFor: 'Nagedacht, {{duration}}',
            thought: 'Gedachte'
        },
        note: {
            hide: 'Verbergen',
            show: 'Tonen',
            openFork: 'Fork openen',
            openWaiting: 'Openen om te antwoorden'
        },
        compaction: {
            plain: 'Context gecomprimeerd',
            from: 'Context gecomprimeerd vanaf {{tokens}} tokens',
            summary: 'Alles hierboven kent de agent alleen nog als samenvatting'
        },
        approval: {
            allow: 'Toegestaan',
            'allow-always': 'Altijd toegestaan',
            deny: 'Geweigerd',
            cancelled: 'Niet meer nodig'
        },
        question: {
            notAnswered: '(niet beantwoord)',
            dismissed: '(weggeklikt)'
        },
        subagent: {
            task: 'Taak',
            label: 'Sub-agent',
            background: 'achtergrond',
            doneIn: 'klaar in {{duration}}',
            failedIn: 'mislukt na {{duration}}',
            nothingYet: 'Nog niets te zien.',
            truncated: 'Alleen het begin is bewaard.',
            showResult: 'Resultaat tonen',
            hideResult: 'Resultaat verbergen'
        },
        task: {
            named: '{{model}}: {{title}}',
            running: 'Bezig',
            waiting: 'Wacht op jou',
            paused: 'Gepauzeerd',
            pausedUntil: 'Gepauzeerd tot {{time}}',
            done: 'Klaar',
            failed: 'Mislukt',
            cancelled: 'Geannuleerd'
        },
        workflow: {
            notStarted: 'nog niet begonnen',
            waiting: 'wacht',
            stopped: 'gestopt',
            stalled: 'Vijf minuten geen voortgang. Hij loopt nog, en je kunt hem stoppen.',
            running: 'Workflow loopt',
            done: 'Workflow klaar',
            failed: 'Workflow mislukt',
            agents_one: '{{count}} agent',
            agents_other: '{{count}} agents',
            working: '{{count}} bezig',
            finished: '{{count}} klaar',
            failedCount: '{{count}} mislukt'
        }
    },
    work: {
        moreCharacters_one: '[nog {{count}} teken]',
        moreCharacters_other: '[nog {{count}} tekens]',
        diffLabel: 'Wijzigingen in {{path}}',
        showDiff: 'Diff tonen',
        loadingDiff: 'Diff laden',
        diffUnavailable: 'Deze diff kon niet worden geladen',
        runningFor: 'loopt al {{elapsed}}',
        awaitingApproval: 'wacht op jou',
        forksAfter_one: 'Fork na deze turn',
        forksAfter_other: '{{count}} forks na deze turn',
        omitted: {
            binary: 'Binair bestand, geen diff',
            tooLarge: 'Te groot om te tonen'
        },
        changedFiles_one: '{{count}} gewijzigd bestand',
        changedFiles_other: '{{count}} gewijzigde bestanden',
        folderChanges_one: '{{count}} mapwijziging tijdens deze beurt',
        folderChanges_other: '{{count}} mapwijzigingen tijdens deze beurt',
        baseMoved: 'Branch verplaatst tijdens deze beurt ({{from}} naar {{to}}). Inclusief wat daarmee binnenkwam.',
        andMore: 'en meer',
        edits_one: '{{count}} bewerking',
        edits_other: '{{count}} bewerkingen',
        workingFor: 'Werkt al',
        exitCode: 'Afsluitcode {{code}}',
        alsoRan: '+ {{programs}}',
        heredoc: 'heredoc',
        moreRuns_one: '+{{count}}',
        moreRuns_other: '+{{count}}',
        showFullOutput: 'Volledige uitvoer tonen',
        showFullDiff: 'Volledige diff tonen',
        wholeSize: '{{size}} in totaal',
        fullOutputFailed: 'De volledige uitvoer kon niet worden geladen',
        fullDiffFailed: 'De volledige diff kon niet worden geladen',
        retry: 'Opnieuw proberen'
    },
    timeline: {
        welcome: {
            morning: 'Goedemorgen',
            afternoon: 'Goedemiddag',
            evening: 'Goedenavond',
            night: 'Nog wakker?'
        },
        empty: {
            ready: '{{model}} staat klaar.',
            ask: 'Vraag maar raak.',
            canRead: 'Kan lezen',
            worksIn: 'Werkt in'
        },
        loading: 'Gesprek laden',
        loadingEarlier: 'Eerdere berichten laden',
        stripFailed: 'Kon de berichten niet tonen',
        cardFailed: 'Kon deze kaart niet tonen',
        actions: {
            label: 'Berichtacties',
            copied: 'Gekopieerd'
        },
        menu: {
            copyMessage: 'Bericht kopiëren',
            copyCode: 'Code kopiëren',
            copyMarkdown: 'Kopiëren als Markdown',
            forkFromHere: 'Vanaf hier forken',
            openInPreview: 'Openen in preview'
        }
    },
    group: {
        tools: {
            Read_one: '{{count}} bestand gelezen',
            Read_other: '{{count}} bestanden gelezen',
            Write_one: '{{count}} bestand geschreven',
            Write_other: '{{count}} bestanden geschreven',
            NotebookEdit_one: '{{count}} notebook bewerkt',
            NotebookEdit_other: '{{count}} notebooks bewerkt',
            Bash_one: '{{count}} commando uitgevoerd',
            Bash_other: "{{count}} commando's uitgevoerd",
            Grep_one: '{{count}} patroon gezocht',
            Grep_other: '{{count}} patronen gezocht',
            Glob_one: '{{count}} patroon opgesomd',
            Glob_other: '{{count}} patronen opgesomd',
            WebFetch_one: '{{count}} pagina opgehaald',
            WebFetch_other: "{{count}} pagina's opgehaald",
            WebSearch_one: '{{count}} zoekopdracht op het web',
            WebSearch_other: '{{count}} zoekopdrachten op het web',
            Task_one: '{{count}} taak uitbesteed',
            Task_other: '{{count}} taken uitbesteed',
            Agent_one: '{{count}} taak uitbesteed',
            Agent_other: '{{count}} taken uitbesteed',
            Skill_one: '{{count}} skill gebruikt',
            Skill_other: '{{count}} skills gebruikt',
            TodoWrite_one: '{{count}} plan bijgewerkt',
            TodoWrite_other: '{{count}} plannen bijgewerkt'
        },
        calls_one: '{{name}}, {{count}} aanroep',
        calls_other: '{{name}}, {{count}} aanroepen',
        edited_one: '{{count}} bestand bewerkt',
        edited_other: '{{count}} bestanden bewerkt',
        toolCalls_one: '{{count}} tool-aanroep',
        toolCalls_other: '{{count}} tool-aanroepen',
        otherCalls_one: '{{count}} andere tool-aanroep',
        otherCalls_other: '{{count}} andere tool-aanroepen'
    },
    turn: {
        about: '{{what}}: {{label}}',
        wokenByTask_one: 'Gewekt door een taak',
        wokenByTask_other: 'Gewekt door {{count}} taken',
        wokenByMessage_one: 'Gewekt door een bericht',
        wokenByMessage_other: 'Gewekt door {{count}} berichten',
        subagentFinished: 'Sub-agent klaar: {{label}}',
        continued: 'Zelf verdergegaan',
        stopped: 'Gestopt na {{duration}}',
        youStopped: 'Jij stopte na {{duration}}',
        failed: 'Mislukt na {{duration}}',
        worked: 'Gewerkt, {{duration}}'
    },
    composer: {
        slotFailed: 'Kon dit onderdeel niet tonen',
        inputLabel: 'Bericht',
        menu: {
            commands: "Commando's",
            skills: 'Skills',
            mentions: 'Vermeldingen',
            references: 'Views en nodes'
        },
        held: {
            question: 'Er wacht een vraag. Opent zodra je stopt met typen.',
            approval: 'Er wacht een goedkeuring. Opent zodra je stopt met typen.',
            show: 'Nu tonen'
        },
        commands: {
            model: 'Wissel van model',
            compact: 'Comprimeer de context',
            clear: 'Begin een nieuwe context',
            goal: 'Werk tot een doel is bereikt',
            skill: 'Skill',
            cli: '{{cli}}-commando',
            anyCli: 'CLI'
        },
        notice: {
            effort: 'Denkniveau op {{effort}}',
            effortHighest: '{{effort}} is het hoogste denkniveau van {{model}}',
            effortLowest: '{{effort}} is het laagste denkniveau van {{model}}',
            noEffort: '{{model}} heeft geen denkniveau',
            clearFailed: 'Kon de thread niet wissen',
            stashChatsDropped_one: '1 chat uit een ander project weggelaten',
            stashChatsDropped_other: '{{count}} chats uit andere projecten weggelaten',
            compactFailed: 'Kon de context niet comprimeren',
            noAttachments: '{{agent}} neemt geen bijlagen aan',
            thisAgent: 'Deze agent',
            rejected: '{{name}}: {{reason}}',
            queuedDoesNotFit: '{{name}} past niet naast dit concept ({{reason}}). Het bericht blijft in de wachtrij.',
            thatFile: 'Dat bestand',
            unreadable: 'Kon dat bestand niet lezen'
        },
        placeholder: {
            disconnected: 'Niet verbonden met de machine',
            lead: 'Vraag maar raak',
            joiner: ', of',
            commands: "commando's",
            files: 'bestanden',
            skills: 'skills',
            readOnly: 'Ga terug naar de main agent om te schrijven'
        },
        jumpToEnd: 'Naar het einde',
        mentions: {
            here: 'Bestanden in deze map',
            files: 'Bestanden',
            noMatch: 'Geen bestanden gevonden',
            empty: 'Hier staan geen bestanden'
        },
        references: {
            canvas: 'Op dit canvas',
            views: 'Views',
            noMatch: 'Geen view of node gevonden',
            kinds: {
                canvas: 'canvas',
                chat: 'chat',
                terminal: 'terminal',
                note: 'notitie',
                text: 'tekst',
                drawing: 'tekening',
                diagram: 'diagram',
                browser: 'browser',
                device: 'apparaat',
                file: 'bestand',
                database: 'tabel'
            }
        },
        queue: {
            attachments_one: '{{count}} bijlage',
            attachments_other: '{{count}} bijlagen',
            alreadySent: 'Al verstuurd',
            editFailed: 'Kon het bericht niet bewerken',
            sendNow: 'Nu versturen',
            paused: 'Wachtrij gepauzeerd. Verstuur een bericht of kies Nu versturen.'
        },
        quote: {
            add: 'Citeren',
            remove: 'Citaat verwijderen',
            goToSource: 'Naar het antwoord'
        },
        removeAttachment: '{{name}} verwijderen',
        attach: 'Bestanden toevoegen',
        tooLong: 'tekens, te lang om te versturen',
        stop: 'Stoppen. Shift-klik stopt ook de sub-agents',
        queueButton: 'In de wachtrij zetten',
        continue: 'Doorgaan',
        continueHint: 'Ga verder met de gestopte beurt',
        send: 'Versturen',
        sendActions: 'Meer verzendopties',
        clear: {
            title: 'Thread wissen?',
            description: 'Er loopt een turn.',
            confirm: 'Stoppen en wissen'
        },
        waitingBelow: 'Antwoord hieronder',
        steerButton: 'Nu versturen. Houd Option of Alt ingedrukt om in de wachtrij te zetten.',
        queueWithSteerButton: 'In de wachtrij na deze beurt. Houd Option of Alt ingedrukt om nu te versturen.'
    },
    activity: {
        subagents_one: '{{count}} sub-agent',
        subagents_other: '{{count}} sub-agents',
        shells_one: '{{count}} shell',
        shells_other: '{{count}} shells',
        monitors_one: '{{count}} monitor',
        monitors_other: '{{count}} monitors',
        pausedUntil: 'gepauzeerd tot {{time}}',
        progress: '{{done}} van {{total}} sub-agents klaar',
        workflow: 'Workflow',
        workflows_one: '{{count}} workflow',
        workflows_other: '{{count}} workflows',
        workflowProgress: '{{name}} · {{done}}/{{total}}',
        workflowStalled: '{{name}} · geen voortgang',
        needsYou_one: '{{count}} vraagt aandacht',
        needsYou_other: '{{count}} vragen aandacht',
        took: {
            done: 'klaar in {{duration}}',
            failed: 'mislukt na {{duration}}',
            cancelled: 'geannuleerd na {{duration}}'
        },
        shell: 'Shell',
        monitor: 'Monitor',
        stop: 'Stoppen',
        stopFailed: 'Kon de taak niet stoppen'
    },
    subagents: {
        stop: {
            task: 'Taak stoppen',
            native: 'Sub-agent stoppen',
            mark: 'Markeren als gestopt. Hij werkt mogelijk door tot de chat stopt.'
        },
        stale: 'Deze sub-agent draait niet meer.',
        title: 'Sub-agents',
        backToMain: 'Terug naar de main agent',
        loading: 'Gesprek laden…',
        working: 'Bezig…',
        unsupported: 'Werk Ruimte op deze machine bij om sub-agents te lezen.',
        unreadable: 'Kon het gesprek niet lezen.',
        noAnswer: 'De machine antwoordde niet',
        stopFailed: 'Kon de sub-agent niet stoppen',
        info: {
            label: 'Over deze sub-agent',
            tokens: '{{tokens}} tokens'
        }
    },
    modes: {
        supervised: {
            label: 'Met toezicht',
            hint: "Vraagt het eerst bij commando's en wijzigingen in bestanden",
            short: 'Vragen'
        },
        'auto-accept-edits': {
            label: 'Bewerkingen automatisch accepteren',
            hint: "Bewerkingen gaan door, commando's vragen het nog",
            short: 'Bewerken'
        },
        auto: {
            label: 'Automatisch',
            hint: 'Beoordeelt routineklussen zelf',
            short: 'Automatisch'
        },
        'full-access': {
            label: 'Volledige toegang',
            hint: 'Vraagt nooit om goedkeuring',
            short: 'Volledig'
        }
    },
    pickers: {
        settings: {
            title: 'Model en rechten'
        },
        model: {
            choose: 'Model kiezen',
            search: 'Modellen zoeken',
            noProvider: 'Geen chat-CLI geïnstalleerd',
            noMatch: 'Geen modellen gevonden',
            allGroup_one: 'Modellen ({{count}})',
            allGroup_other: 'Modellen ({{count}})',
            legacyGroup_one: 'Legacy-modellen ({{count}})',
            legacyGroup_other: 'Legacy-modellen ({{count}})',
            legacy: 'Legacy',
            tools: 'Kan tools gebruiken',
            requires: 'Vereist {{cli}} {{version}} of nieuwer op {{machine}}',
            requiresHere: 'Vereist {{cli}} {{version}} of nieuwer',
            providerSettings: 'Providerinstellingen',
            star: 'Aan favorieten toevoegen',
            unstar: 'Uit favorieten halen'
        },
        stash: {
            title: 'Stashed prompts',
            noText: 'Geen tekst',
            files_one: '{{count}} bestand, niet bewaard',
            files_other: '{{count}} bestanden, niet bewaard',
            chats_one: '{{count}} chat bijgevoegd',
            chats_other: '{{count}} chats bijgevoegd'
        },
        mode: {
            label: 'Rechten',
            effective: 'Draait met {{effective}}. Gekozen: {{requested}}.'
        },
        account: {
            label: 'Account',
            manage: 'Accounts beheren…',
            resets: 'reset om {{time}}',
            forkToSwitch: '{{account}} kan dit gesprek niet openen. Fork de chat om verder te gaan op {{account}}.'
        }
    },
    scrubber: {
        strip: 'Berichten',
        tasks: 'Taken'
    },
    bookmarks: {
        menu: 'Bladwijzers',
        add: 'Bladwijzer plaatsen',
        rename: 'Bladwijzer hernoemen',
        remove: 'Bladwijzer verwijderen',
        unnamed: 'Bladwijzer',
        nameLabel: 'Naam van de bladwijzer',
        namePlaceholder: 'Optioneel',
        removed: 'Bladwijzer verwijderd',
        addFailed: 'Kon de bladwijzer niet toevoegen',
        renameFailed: 'Kon de bladwijzer niet hernoemen',
        removeFailed: 'Kon de bladwijzer niet verwijderen'
    },
    visuals: {
        actions: 'Acties voor {{title}}',
        expand: 'Groot openen',
        more: 'Meer acties',
        remove: 'Visualisatie verwijderen',
        removeTitle: 'Visualisatie verwijderen?',
        removeDescription: '{{title}} wordt uit de chat verwijderd. Dit kan niet ongedaan worden gemaakt.',
        removeFailed: 'Kon de visualisatie niet verwijderen',
        loading: '{{title}} wordt geladen',
        failed: 'Kon {{title}} niet laden',
        renderFailed: 'Kon deze visualisatie niet tonen'
    },
    image: {
        zoomIn: 'Inzoomen',
        zoomOut: 'Uitzoomen',
        reset: 'Herstellen',
        previous: 'Vorige afbeelding',
        next: 'Volgende afbeelding',
        position: '{{index}} van {{count}}'
    },
    generatedImage: {
        label: 'Gegenereerde afbeelding',
        generating: 'Afbeelding wordt gemaakt',
        failed: 'Kon de afbeelding niet maken',
        empty: 'Afbeelding is leeg',
        notImage: 'Geen afbeelding',
        tooLarge: 'Groter dan {{size}}',
        dimensions: '{{width}} × {{height}}',
        transparent: 'transparant',
        actions: 'Acties voor de afbeelding',
        more: 'Meer acties',
        copyPrompt: 'Prompt kopiëren',
        open: 'Openen',
        openLarge: 'Groot openen',
        save: 'Opslaan in project…',
        saved: 'Opgeslagen',
        savedTo: 'Opgeslagen in <file>{{path}}</file>',
        renderFailed: 'Kon deze afbeelding niet tonen'
    },
    account: {
        pill: '{{provider}}-account {{account}}'
    },
    common: {
        action: {
            close: 'Sluiten',
            copy: 'Kopiëren',
            delete: 'Verwijderen',
            dismiss: 'Sluiten',
            edit: 'Bewerken',
            remove: 'Verwijderen',
            selectAll: 'Alles selecteren',
            undo: 'Ongedaan maken'
        },
        status: {
            running: 'bezig',
            paused: 'gepauzeerd',
            done: 'klaar',
            failed: 'mislukt',
            cancelled: 'geannuleerd'
        }
    },
    code: {
        actions: 'Codeacties',
        copyFailed: 'Kon de code niet kopiëren.',
        mermaid: {
            diagram: 'Diagram',
            showSource: 'Bron tonen',
            showDiagram: 'Diagram tonen',
            failed: 'Kon het diagram niet tonen. Dit is de bron.',
            crashed: 'Kon dit diagram niet tonen'
        }
    },
    blocks: {
        label: 'Interactief blok',
        progress: {
            label: 'Voortgang',
            of: '{{value}} van {{max}}'
        },
        step: {
            done: 'Klaar',
            running: 'Bezig',
            pending: 'Wacht',
            failed: 'Mislukt',
            skipped: 'Overgeslagen'
        },
        event: {
            tone: {
                neutral: 'Neutraal',
                info: 'Info',
                success: 'Gelukt',
                warning: 'Waarschuwing',
                danger: 'Gevaar'
            }
        },
        stat: {
            change: '{{change}} vanaf {{previous}}',
            from: 'vanaf {{previous}}'
        },
        table: {
            label: 'Tabel van {{columns}}',
            showAll: 'Alle {{total}} rijen tonen'
        },
        chart: {
            values: 'Waarden',
            summary: '{{count}} waarden, hoogste {{label}} met {{value}}',
            summarySeries: '{{count}} categorieën, hoogste {{series}} bij {{label}} met {{value}}',
            rowsLeftOut: '{{shown}} van {{total}} rijen getoond.',
            seriesLeftOut_one: '{{series}} niet getoond.',
            seriesLeftOut_other: '{{series}} niet getoond.',
            sideBySide: 'Negatieve waarden kunnen niet stapelen. Reeksen staan naast elkaar.',
            showValues: 'Alle waarden tonen',
            hideValues: 'Waarden verbergen'
        },
        gallery: {
            label_one: '{{count}} afbeelding',
            label_other: '{{count}} afbeeldingen'
        },
        map: {
            label_one: 'Kaart met {{count}} plek',
            label_other: 'Kaart met {{count}} plekken',
            omitted_one: '{{count}} plek meer niet getoond',
            omitted_other: '{{count}} plekken meer niet getoond',
            show: 'Kaart tonen',
            waiting: 'Wacht om de kaart te tekenen. Er staan maar een paar kaarten tegelijk.',
            contextLost: 'Kon de kaart niet tonen. De plekken blijven in de lijst.',
            lookingUp: 'Wordt opgezocht',
            notFound: 'Niet op de kaart',
            zoomIn: 'Inzoomen',
            zoomOut: 'Uitzoomen',
            showAll: 'Alle plekken tonen',
            scrollHint: 'Houd ⌘ of Ctrl ingedrukt en scrol om te zoomen',
            touchHint: 'Gebruik twee vingers om de kaart te bewegen',
            offline: 'Geen kaarttegels offline. De plekken blijven in de lijst.',
            disabled: 'Kaarttegels staan uit.',
            signedOut: 'Log in om kaarttegels te tonen.',
            unavailable: 'Kaarttegels niet beschikbaar.'
        },
        compare: {
            label: 'Vergelijk {{before}} en {{after}}',
            before: 'Voor',
            after: 'Na',
            missing: 'Eén afbeelding ontbreekt'
        },
        image: {
            label: 'Afbeelding',
            unavailable: 'Afbeelding niet beschikbaar'
        },
        model: {
            label: '3D-model',
            unavailable: 'Model niet beschikbaar',
            crashed: 'Kon dit model niet tonen'
        },
        sources: 'Bronnen',
        citation: 'Bron {{number}}: {{title}}',
        outsideProject: 'Buiten het project, als tekst getoond',
        textField: {
            count: '{{used}} van {{max}} tekens'
        },
        options: 'Opties',
        choices: 'Keuzes',
        checklist: 'Checklijst',
        choice: {
            waiting: 'Beschikbaar zodra het antwoord klaar is',
            reading: 'Beschikbaar zodra de live gegevens gelezen zijn',
            unavailable: 'Niet beschikbaar',
            sent: 'Verstuurd',
            queued: 'In de wachtrij',
            failed: 'Versturen lukte niet. Probeer het opnieuw.',
            ready: 'De keuzes staan klaar'
        },
        answered: 'Beantwoord met “{{label}}”',
        chose: 'Gekozen: “{{label}}”',
        choseOlder: 'Gekozen: “{{label}}”, bij het antwoord van {{time}}',
        notes_one: '{{count}} opmerking',
        notes_other: '{{count}} opmerkingen',
        shownAsText: 'Als tekst getoond',
        unknownComponent: 'Deze versie kan {{component}} niet tekenen',
        renderFailed: 'Kon dit deel niet tonen',
        unreadable: 'Kon het blok niet lezen',
        live: {
            label: 'Live',
            read: 'gelezen {{time}}',
            sources: 'Leest {{sources}}',
            failed: '{{source}} lezen lukte niet',
            refused: 'Geen toegang tot {{source}}',
            notRead: 'Niet gelezen',
            reasons: {
                'access-unavailable': 'De chat die dit maakte heeft geen toegang meer.',
                'block-stale': 'Dit blok is veranderd sinds het getekend werd.',
                busy: 'Er lezen te veel live blokken tegelijk.',
                'link-unchecked': 'Deze link moet opnieuw gecontroleerd worden.',
                'link-unsupported': 'De machine kan deze link niet openen.',
                'links-unsupported': 'De machine opent geen links uit blokken.',
                'no-unique-match': 'Geen eenduidige overeenkomst voor die naam.',
                'outside-project': 'Buiten het project van de agent.',
                'query-undeclared': 'Dit blok leest die bron niet.',
                'refresh-limit': 'Deze bron leest hooguit eens per tien seconden.',
                'result-too-large': 'Resultaat te groot.',
                'snapshot-too-large': 'De eerste metingen waren te groot om te bewaren.',
                'source-unregistered': 'De machine kent deze bron niet.',
                'stale-read': 'Lees de bron opnieuw voordat je kiest.',
                'target-unavailable': 'Doel niet meer beschikbaar.',
                'timed-out': 'Bron reageerde te traag.',
                unreadable: 'Kon de bron niet lezen.'
            }
        }
    },
    modelOptions: {
        effort: {
            label: 'Denkniveau',
            choices: {
                low: 'Laag',
                medium: 'Gemiddeld',
                high: 'Hoog',
                xhigh: 'Extra hoog',
                max: 'Max'
            }
        },
        contextWindow: { label: 'Contextvenster' },
        fastMode: { label: 'Snelle modus' },
        thinking: { label: 'Nadenken' },
        serviceTier: { label: 'Voorrang' }
    },
    readingWidth: {
        label: 'Leesbreedte',
        narrow: {
            label: 'Smal',
            hint: 'Korte, makkelijke regels.'
        },
        comfortable: {
            label: 'Comfortabel',
            hint: 'Ongeveer 90 tekens per regel.'
        },
        full: {
            label: 'Volledig',
            hint: 'Zo breed als de weergave.'
        }
    },
    sendKey: {
        label: 'Versturen met',
        enter: {
            label: 'Enter',
            hint: 'Enter verstuurt en Shift+Enter voegt een regel toe.'
        },
        'mod-enter-multiline': {
            label: 'Enter, {{mod}}+Enter bij meer regels',
            hint: 'Enter verstuurt één regel. Met meer regels voegt Enter een regel toe en verstuurt {{mod}}+Enter.'
        },
        'mod-enter': {
            label: '{{mod}}+Enter',
            hint: 'Enter voegt een regel toe en {{mod}}+Enter verstuurt.'
        }
    }
};
