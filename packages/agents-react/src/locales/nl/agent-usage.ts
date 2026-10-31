export default {
    limits: {
        title: 'Limieten',
        explain: 'De markering toont waar het verbruik bij een gelijk tempo zou staan. Voorbij de markering verbruik je sneller dan het weer vrijkomt.',
        loading: 'Limieten laden…',
        used: '{{percent}}% gebruikt',
        bar: '{{window}}, {{percent}}% gebruikt',
        windowPassed: '{{percent}}% van het venster voorbij',
        faster: 'Sneller verbruikt dan het weer vrijkomt.',
        slower: 'Langzamer verbruikt dan het weer vrijkomt.',
        pace: {
            ahead: '{{percent}}% gebruikt, voor op een gelijkmatig tempo van {{pace}}%',
            behind: '{{percent}}% gebruikt, achter op een gelijkmatig tempo van {{pace}}%',
            even: '{{percent}}% gebruikt, op een gelijkmatig tempo'
        },
        even: 'Even snel verbruikt als het vrijkomt.',
        resets: 'Reset {{at}}',
        none: 'Nog geen limieten gemeld.',
        notInstalled: 'Niet geïnstalleerd op deze machine.',
        noSubscription: 'API-sleutel, geen abonnementslimieten.',
        unreachable: 'Kon de limieten niet ophalen.',
        filter: 'Getoonde accounts',
        signedOut: 'Niet ingelogd',
        signedOutDetail: 'Niet ingelogd. Log in om limieten te zien.',
        logIn: 'Inloggen',
        checked: {
            now: 'nu',
            ago: '{{duration}} geleden',
            fromTurn: 'Uit een turn · {{when}}'
        }
    },
    settings: {
        currency: {
            label: 'Valuta',
            dollars: 'Prijzen zoals gepubliceerd, in dollars.',
            noRate: 'Nog geen wisselkoers. Bedragen in dollars.',
            converted: 'Omgerekend met de ECB-koers van {{date}}.',
            options: {
                USD: 'Dollars',
                EUR: "Euro's"
            }
        },
        page: {
            label: 'Verbruikspagina',
            description: 'Kosten, tokens en planlimieten, per account.',
            open: 'Verbruik openen'
        }
    },
    section: {
        label: 'Verbruik',
        description: 'Valuta van de verbruikspagina.'
    },
    dialog: {
        title: 'Verbruik',
        description: 'Kosten, tokens en limieten van je abonnement',
        close: 'Verbruik sluiten',
        rescan: 'Opnieuw scannen',
        period: 'Periode',
        metric: 'Eenheid',
        failed: 'Kon het verbruik niet tonen',
        periods: {
            today: 'Vandaag',
            '7d': '7 dagen',
            '30d': '30 dagen',
            '90d': '90 dagen'
        },
        metrics: {
            cost: 'Kosten',
            tokens: 'Tokens'
        },
        accounts: {
            label: 'Account',
            all: 'Alle accounts'
        }
    },
    empty: {
        noTranscripts: 'Nog geen chats van Claude of Codex gevonden op deze machine.',
        noUsage: 'Nog geen verbruik.'
    },
    agents: {
        none: 'Geen agent-CLI geïnstalleerd.',
        installed: 'Geïnstalleerd: {{list}}.',
        settings: 'Agent-instellingen'
    },
    provenance: {
        failed: 'Kon het laatste verbruik niet lezen. Dit zijn de vorige resultaten.',
        scanned_one: 'Gescand om {{time}}, {{files}} bestand',
        scanned_other: 'Gescand om {{time}}, {{files}} bestanden',
        bundledPrices: 'Ingebouwde prijzen',
        fetchedPrices: 'Prijzen van {{date}}',
        rate: '{{currency}} tegen de ECB-koers van {{date}}'
    },
    summary: {
        sessions_one: '{{sessions}} sessie',
        sessions_other: '{{sessions}} sessies',
        calls_one: '{{calls}} aanroep',
        calls_other: '{{calls}} aanroepen',
        apiRates: 'tegen API-tarieven'
    },
    tiles: {
        processed: 'Verwerkt',
        uncachedInput: 'Input zonder cache',
        cachedInput: 'Input uit cache',
        cacheWrites: 'Naar cache geschreven',
        output: 'Output',
        cacheSavings: 'Bespaard met cache'
    },
    chart: {
        total: 'Totaal'
    },
    breakdown: {
        title: 'Uitsplitsing',
        tabs: {
            models: 'Modellen',
            projects: 'Projecten',
            day: 'Dag'
        },
        models: {
            model: 'Model',
            calls: 'Aanroepen',
            input: 'Input',
            output: 'Output',
            cache: 'Cache R/W',
            cost: 'Kosten',
            share: 'Aandeel',
            pricedAs: 'Geprijsd als {{model}}',
            noPrice: 'Geen prijs bekend'
        },
        days: {
            day: 'Dag',
            total: 'Totaal',
            tokens: 'Tokens',
            empty: 'Geen activiteit in deze periode.'
        }
    }
};
